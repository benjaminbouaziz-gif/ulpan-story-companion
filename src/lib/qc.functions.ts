import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { texteErreurBase } from "./db-error";
import {
  controleActif,
  FAMILLES,
  lirePolitique,
  NOM_FAMILLE,
  type Famille,
  type Strategie,
} from "./qc-core.server";
import { controlerEtape, corrigerDepuisRapport, forcerValidation, type ResumeControle } from "./qc-run.server";

/**
 * BRIQUE 9 — LES FONCTIONS SERVEUR DU CONTRÔLE QUALITÉ.
 * Toute lecture et toute écriture commencent par assertEditor : le rôle est lu
 * en base, jamais annoncé par le client.
 */

const STATUTS: Record<string, string> = {
  en_cours: "en attente de contrôle",
  valide: "validé",
  a_revoir: "à revoir manuellement",
  arrete_plafond: "arrêté, plafond atteint",
  arrete_stagnation: "arrêté, note stagnante",
  erreur: "à revoir manuellement (erreur)",
  force_valide: "validé de force par l'éditeur",
};

export const NOM_STRATEGIE: Record<Strategie, string> = {
  aucun: "aucun contrôle",
  une_fois: "juger et corriger une fois",
  boucle: "boucle",
};

export type QcVerdictRow = {
  id: string;
  code: string;
  label: string;
  family: Famille;
  familyLabel: string;
  isBlocking: boolean;
  species: "juge" | "mecanique";
  verdict: "valide" | "echoue";
  location: string | null;
  explanation: string | null;
};

export type QcReportRow = {
  id: string;
  round: number;
  chapterNo: number | null;
  status: string;
  statusLabel: string;
  passed: boolean;
  blockingFailed: number;
  criteriaTotal: number;
  criteriaPassed: number;
  scoreGeneral: number | null;
  scores: { family: Famille; label: string; score: number | null }[];
  stopReason: string | null;
  message: string | null;
  modelUsed: string | null;
  durationMs: number | null;
  planVersion: number | null;
  createdAt: string;
  verdicts: QcVerdictRow[];
};

export type QcGridRow = {
  id: string;
  code: string;
  name: string;
  stepCode: string;
  isActive: boolean;
  criteres: {
    id: string;
    sortOrder: number;
    code: string;
    label: string;
    question: string;
    family: Famille;
    familyLabel: string;
    isBlocking: boolean;
    species: "juge" | "mecanique";
    mechanicKey: string | null;
    isActive: boolean;
  }[];
};

/* ------------------------------------------------------------------ */
/* L'INTERRUPTEUR GLOBAL                                               */
/* ------------------------------------------------------------------ */

export const qcSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ enabled: boolean }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return { enabled: await controleActif(editor) };
  });

export const setQcEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ enabled: z.boolean() }).parse(data))
  .handler(async ({ context, data }): Promise<{ enabled: boolean }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { error } = await admin
      .from("qc_settings")
      .upsert({ id: true, enabled: data.enabled, updated_at: new Date().toISOString() });
    if (error) throw new Error(texteErreurBase("Le réglage du contrôle qualité n'a pas pu être écrit", error));
    return { enabled: data.enabled };
  });

/* ------------------------------------------------------------------ */
/* LES GRILLES DE CRITÈRES                                             */
/* ------------------------------------------------------------------ */

export const qcGrids = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QcGridRow[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const [{ data: grids }, { data: criteres }] = await Promise.all([
      admin.from("qc_grids").select("id, code, name, step_code, is_active").order("code", { ascending: true }),
      admin
        .from("qc_criteria")
        .select("id, grid_id, sort_order, code, label, question, family, is_blocking, species, mechanic_key, is_active")
        .order("sort_order", { ascending: true }),
    ]);
    return (grids ?? []).map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      stepCode: g.step_code,
      isActive: g.is_active,
      criteres: (criteres ?? [])
        // LES RÈGLES JUGÉES NE SONT PLUS DES LIGNES : cet écran ne montre
        // plus que les mesures calculées par le code.
        .filter((c) => c.grid_id === g.id && c.species === "mecanique")
        .map((c) => ({
          id: c.id,
          sortOrder: c.sort_order,
          code: c.code,
          label: c.label,
          question: c.question,
          family: c.family as Famille,
          familyLabel: NOM_FAMILLE[c.family as Famille] ?? c.family,
          isBlocking: c.is_blocking,
          species: (c.species as "juge" | "mecanique") ?? "juge",
          mechanicKey: c.mechanic_key ?? null,
          isActive: c.is_active,
        })),
    }));
  });

export const saveQcGrid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().trim().min(1).max(60),
        name: z.string().trim().min(1).max(160),
        stepCode: z.string().trim().min(1).max(60),
        isActive: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    if (data.id) {
      const { error } = await admin
        .from("qc_grids")
        .update({
          code: data.code,
          name: data.name,
          step_code: data.stepCode,
          is_active: data.isActive ?? true,
        })
        .eq("id", data.id);
      if (error) throw new Error(texteErreurBase("La grille n'a pas pu être enregistrée", error));
      return { id: data.id };
    }
    const { data: grid, error } = await admin
      .from("qc_grids")
      .insert({ code: data.code, name: data.name, step_code: data.stepCode, is_active: data.isActive ?? true })
      .select("id")
      .single();
    if (error || !grid) throw new Error(texteErreurBase("La grille n'a pas pu être créée", error));
    return { id: grid.id };
  });

export const saveQcCriterion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        gridId: z.string().uuid(),
        sortOrder: z.number().int().min(1).max(999),
        code: z.string().trim().min(1).max(60),
        label: z.string().trim().min(1).max(200),
        question: z.string().trim().min(1).max(2000),
        family: z.enum(["conformite", "structure", "pedagogie", "langue"]),
        isBlocking: z.boolean(),
        species: z.enum(["juge", "mecanique"]),
        mechanicKey: z.string().trim().max(60).nullable().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    if (data.species === "mecanique" && !(data.mechanicKey ?? "").trim())
      throw new Error("Un critère mécanique doit porter une clé de calcul.");
    const ligne = {
      grid_id: data.gridId,
      sort_order: data.sortOrder,
      code: data.code,
      label: data.label,
      question: data.question,
      family: data.family,
      is_blocking: data.isBlocking,
      species: data.species,
      mechanic_key: data.species === "mecanique" ? (data.mechanicKey ?? null) : null,
      is_active: data.isActive ?? true,
    };
    if (data.id) {
      const { error } = await admin.from("qc_criteria").update(ligne).eq("id", data.id);
      if (error) throw new Error(texteErreurBase("Le critère n'a pas pu être enregistré", error));
      return { id: data.id };
    }
    const { data: crit, error } = await admin.from("qc_criteria").insert(ligne).select("id").single();
    if (error || !crit) throw new Error(texteErreurBase("Le critère n'a pas pu être créé", error));
    return { id: crit.id };
  });

export const deleteQcCriterion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    // On désactive : les verdicts déjà rendus gardent leur critère en mémoire.
    const { error } = await admin.from("qc_criteria").update({ is_active: false }).eq("id", data.id);
    if (error) throw new Error(texteErreurBase("Le critère n'a pas pu être retiré", error));
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* LA STRATÉGIE, ÉTAPE PAR ÉTAPE (FICHE DU LIVRE)                      */
/* ------------------------------------------------------------------ */

export type QcStepPolicyRow = {
  stepId: string;
  rank: number;
  labelFr: string;
  stepCode: string;
  strategy: Strategie;
  strategyLabel: string;
  maxRounds: number;
  passThreshold: number;
  gridId: string | null;
  gridName: string | null;
  hasController: boolean;
  firstReport: { round: number; scoreGeneral: number | null } | null;
  lastReport: QcReportRow | null;
};

/** Un rapport, verdicts triés : bloquants échoués, puis échoués, puis validés. */
function trierVerdicts(rows: QcVerdictRow[]): QcVerdictRow[] {
  const poids = (v: QcVerdictRow) =>
    v.verdict === "echoue" ? (v.isBlocking ? 0 : 1) : 2;
  return [...rows].sort((a, b) => poids(a) - poids(b) || a.code.localeCompare(b.code, "fr"));
}

type RapportBase = {
  id: string;
  round: number;
  chapter_no: number | null;
  status: string;
  passed: boolean;
  blocking_failed: number;
  criteria_total: number;
  criteria_passed: number;
  score_general: number | null;
  score_conformite: number | null;
  score_structure: number | null;
  score_pedagogie: number | null;
  score_langue: number | null;
  stop_reason: string | null;
  message: string | null;
  model_used: string | null;
  duration_ms: number | null;
  plan_version: number | null;
  created_at: string;
};

function mapRapport(r: RapportBase, verdicts: QcVerdictRow[]): QcReportRow {
  const parFamille: Record<Famille, number | null> = {
    conformite: r.score_conformite === null ? null : Number(r.score_conformite),
    structure: r.score_structure === null ? null : Number(r.score_structure),
    pedagogie: r.score_pedagogie === null ? null : Number(r.score_pedagogie),
    langue: r.score_langue === null ? null : Number(r.score_langue),
  };
  return {
    id: r.id,
    round: r.round,
    chapterNo: r.chapter_no ?? null,
    status: r.status,
    statusLabel: STATUTS[r.status] ?? r.status,
    passed: r.passed,
    blockingFailed: r.blocking_failed,
    criteriaTotal: r.criteria_total,
    criteriaPassed: r.criteria_passed,
    scoreGeneral: r.score_general === null ? null : Number(r.score_general),
    scores: FAMILLES.map((f) => ({ family: f, label: NOM_FAMILLE[f], score: parFamille[f] })),
    stopReason: r.stop_reason ?? null,
    message: r.message ?? null,
    modelUsed: r.model_used ?? null,
    durationMs: r.duration_ms ?? null,
    planVersion: r.plan_version ?? null,
    createdAt: r.created_at,
    verdicts: trierVerdicts(verdicts),
  };
}

const CHAMPS_RAPPORT =
  "id, round, chapter_no, status, passed, blocking_failed, criteria_total, criteria_passed, score_general, score_conformite, score_structure, score_pedagogie, score_langue, stop_reason, message, model_used, duration_ms, plan_version, created_at";

async function lireRapports(
  editor: Awaited<ReturnType<typeof assertEditor>>,
  bookStepIds: string[],
): Promise<Map<string, QcReportRow[]>> {
  const admin = await getAdminClient(editor);
  if (bookStepIds.length === 0) return new Map();
  const { data: rapports } = await admin
    .from("qc_reports")
    .select(`${CHAMPS_RAPPORT}, book_step_id`)
    .in("book_step_id", bookStepIds)
    .order("created_at", { ascending: false })
    .limit(200);
  const ids = (rapports ?? []).map((r) => r.id);
  const { data: verdicts } = ids.length
    ? await admin
        .from("qc_verdicts")
        .select("id, report_id, criterion_code, label, family, is_blocking, species, verdict, location, explanation")
        .in("report_id", ids)
    : { data: [] as never[] };

  const parRapport = new Map<string, QcVerdictRow[]>();
  for (const v of verdicts ?? []) {
    const liste = parRapport.get(v.report_id) ?? [];
    liste.push({
      id: v.id,
      code: v.criterion_code,
      label: v.label,
      family: v.family as Famille,
      familyLabel: NOM_FAMILLE[v.family as Famille] ?? v.family,
      isBlocking: v.is_blocking,
      species: (v.species as "juge" | "mecanique") ?? "juge",
      verdict: v.verdict as "valide" | "echoue",
      location: v.location ?? null,
      explanation: v.explanation ?? null,
    });
    parRapport.set(v.report_id, liste);
  }

  const parEtape = new Map<string, QcReportRow[]>();
  for (const r of rapports ?? []) {
    const liste = parEtape.get(r.book_step_id) ?? [];
    liste.push(mapRapport(r as RapportBase, parRapport.get(r.id) ?? []));
    parEtape.set(r.book_step_id, liste);
  }
  return parEtape;
}

/** La page du livre : la stratégie de chaque étape intelligente, et ses notes. */
export const qcBookPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ enabled: boolean; steps: QcStepPolicyRow[]; grids: { id: string; name: string }[] }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const enabled = await controleActif(editor);

    const { data: steps } = await admin
      .from("book_steps")
      .select("id, rank, label_fr, step_code, species")
      .eq("book_id", data.bookId)
      .eq("species", "llm")
      .order("rank", { ascending: true });

    const [{ data: grids }, rapports] = await Promise.all([
      admin.from("qc_grids").select("id, name").eq("is_active", true).order("name", { ascending: true }),
      lireRapports(editor, (steps ?? []).map((s) => s.id)),
    ]);

    const lignes: QcStepPolicyRow[] = [];
    for (const s of steps ?? []) {
      const politique = await lirePolitique(editor, s.id);
      const liste = rapports.get(s.id) ?? [];
      const premier = liste[liste.length - 1] ?? null;
      lignes.push({
        stepId: s.id,
        rank: s.rank,
        labelFr: s.label_fr,
        stepCode: s.step_code,
        strategy: politique.strategy,
        strategyLabel: NOM_STRATEGIE[politique.strategy],
        maxRounds: politique.maxRounds,
        passThreshold: politique.passThreshold,
        gridId: politique.gridId,
        gridName: (grids ?? []).find((g) => g.id === politique.gridId)?.name ?? null,
        hasController: s.step_code === "plan" || s.step_code === "redaction",
        firstReport: premier ? { round: premier.round, scoreGeneral: premier.scoreGeneral } : null,
        lastReport: liste[0] ?? null,
      });
    }

    return { enabled, steps: lignes, grids: (grids ?? []).map((g) => ({ id: g.id, name: g.name })) };
  });

export const setQcStepPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bookStepId: z.string().uuid(),
        strategy: z.enum(["aucun", "une_fois", "boucle"]),
        maxRounds: z.number().int().min(1).max(10),
        passThreshold: z.number().int().min(0).max(100),
        gridId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    // Changer de stratégie n'affecte jamais un lancement en cours : la
    // stratégie est lue au DÉBUT d'un contrôle, jamais pendant.
    const { error } = await admin.from("qc_step_policies").upsert(
      {
        book_step_id: data.bookStepId,
        strategy: data.strategy,
        max_rounds: data.maxRounds,
        pass_threshold: data.passThreshold,
        grid_id: data.gridId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "book_step_id" },
    );
    if (error) throw new Error(texteErreurBase("La stratégie de contrôle n'a pas pu être écrite", error));
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* LE DOSSIER D'ÉTAPE ET LA FILE D'ATTENTE                             */
/* ------------------------------------------------------------------ */

export type QcStepDossier = {
  enabled: boolean;
  strategy: Strategie;
  strategyLabel: string;
  maxRounds: number;
  passThreshold: number;
  hasController: boolean;
  reports: QcReportRow[];
};

export const qcStepDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<QcStepDossier> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const enabled = await controleActif(editor);
    const politique = await lirePolitique(editor, data.bookStepId);
    const { data: step } = await admin
      .from("book_steps")
      .select("step_code")
      .eq("id", data.bookStepId)
      .maybeSingle();
    const rapports = await lireRapports(editor, [data.bookStepId]);
    return {
      enabled,
      strategy: politique.strategy,
      strategyLabel: NOM_STRATEGIE[politique.strategy],
      maxRounds: politique.maxRounds,
      passThreshold: politique.passThreshold,
      hasController: step?.step_code === "plan" || step?.step_code === "redaction",
      reports: rapports.get(data.bookStepId) ?? [],
    };
  });

export type QcQueueLine = { stepId: string; line: string; passed: boolean };

/** Le verdict de chaque étape contrôlée, en une ligne, pour la file d'attente. */
export const qcQueueVerdicts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QcQueueLine[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data: rapports } = await admin
      .from("qc_reports")
      .select("book_step_id, round, status, passed, blocking_failed, score_general, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    const vus = new Set<string>();
    const lignes: QcQueueLine[] = [];
    for (const r of rapports ?? []) {
      if (vus.has(r.book_step_id)) continue;
      vus.add(r.book_step_id);
      const note = r.score_general === null ? "—" : `${Number(r.score_general)} %`;
      const line =
        r.status === "valide" || r.status === "force_valide"
          ? `${STATUTS[r.status]}, ${note}`
          : r.status === "arrete_plafond"
            ? `arrêté au tour ${r.round}, plafond atteint`
            : r.status === "arrete_stagnation"
              ? `arrêté au tour ${r.round}, note stagnante`
              : r.blocking_failed > 0
                ? `à revoir, ${r.blocking_failed} bloquant${r.blocking_failed > 1 ? "s" : ""}`
                : `à revoir, ${note}`;
      lignes.push({ stepId: r.book_step_id, line, passed: r.passed });
    }
    return lignes;
  });

/* ------------------------------------------------------------------ */
/* LES ACTIONS                                                         */
/* ------------------------------------------------------------------ */

export const runQcControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bookStepId: z.string().uuid(),
        chapterNo: z.number().int().min(1).max(99).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<ResumeControle> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return controlerEtape(editor, { ...data, forcer: true });
  });

export const qcSendToCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ reportId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ message: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return { message: await corrigerDepuisRapport(editor, data.reportId) };
  });

export const qcForceValidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ reportId: z.string().uuid(), comment: z.string().trim().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    await forcerValidation(editor, data);
    return { ok: true };
  });
