import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { artifactPath } from "./artifact-path";
import { downloadArtifactText, sha256Hex, uploadArtifactBytes } from "./atelier-artifacts.server";
import { texteErreurBase } from "./db-error";
import {
  executerControlePlan,
  promptDuRole,
  type Notes,
  type ResultatControle,
  type VerdictLigne,
} from "./plan-controle.server";

import { promptVide, type ModeControle } from "./atelier-models";

/**
 * LES PORTES DU CONTRÔLE DU PLAN.
 *
 * Rien ici ne valide une étape : la signature humaine reste dans le dossier
 * d'étape. Chaque appel relit le rôle en base avant de toucher quoi que ce soit.
 */

export type ReglagesControle = {
  enabled: boolean;
  mode: ModeControle;
  maxIterations: number;
  /** Les modèles effectifs, dérivés des prompts moteurs actifs. */
  modeleControleur: string | null;
  modeleRedacteur: string | null;
  /** Ce qui manque encore pour que le contrôle puisse partir, en clair. */
  manques: string[];
};

export const planControlSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReglagesControle> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data } = await admin
      .from("plan_control_settings")
      .select("enabled, mode, max_iterations")
      .eq("id", true)
      .maybeSingle();

    const [methode, regles, correctif] = await Promise.all([
      promptDuRole(editor, "plan", "methode_controle"),
      promptDuRole(editor, "plan", "regles_controle"),
      promptDuRole(editor, "plan", "redaction_corrective"),
    ]);

    const mode = (data?.mode ?? "A") as ModeControle;
    const manques: string[] = [];
    if (!methode) manques.push("Le prompt Plan × Méthode (contrôle) n'existe pas.");
    else if (promptVide(methode.content)) manques.push("Le prompt Plan × Méthode (contrôle) est encore vide.");
    if (!regles) manques.push("Le prompt Plan × Règles de contrôle n'existe pas.");
    else if (promptVide(regles.content)) manques.push("Le prompt Plan × Règles de contrôle est encore vide.");
    if (mode !== "A") {
      if (!correctif) manques.push("Le prompt Plan × Rédaction corrective n'existe pas.");
      else if (promptVide(correctif.content))
        manques.push("Le prompt Plan × Rédaction corrective est encore vide.");
    }

    return {
      enabled: data?.enabled ?? false,
      mode,
      maxIterations: data?.max_iterations ?? 1,
      modeleControleur: regles?.model ?? null,
      modeleRedacteur: correctif?.model ?? null,
      manques,
    };
  });

export const setPlanControlSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        enabled: z.boolean().optional(),
        mode: z.enum(["A", "B", "C"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const patch = {
      updated_at: new Date().toISOString(),
      ...(data.enabled === undefined ? {} : { enabled: data.enabled }),
      ...(data.mode === undefined ? {} : { mode: data.mode }),
    };
    const { error } = await admin.from("plan_control_settings").update(patch).eq("id", true);
    if (error) throw new Error(texteErreurBase("Les réglages du contrôle n'ont pas pu être enregistrés", error));
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* L'ÉTAT DU CONTRÔLE DANS L'ÉTAPE PLAN                                */
/* ------------------------------------------------------------------ */

export type ControleRunRow = {
  id: string;
  mode: ModeControle;
  status: string;
  phase: string | null;
  planVersion: number | null;
  verdicts: VerdictLigne[] | null;
  notes: Notes | null;
  propositions: VerdictLigne[];
  moyenne: number | null;
  controleurModelUsed: string | null;
  redacteurModelUsed: string | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  planV2ArtifactId: string | null;
  reportArtifactId: string | null;
  /** Nombre de points attendus du modèle (les mesurés par le code exclus). */
  attendus: number | null;
};

export type ControleEtat = {
  isPlanStep: boolean;
  enabled: boolean;
  mode: ModeControle;
  maxIterations: number;
  manques: string[];
  hasPlan: boolean;
  planVersion: number | null;
  /** Le texte du plan courant, montré dans le volet de gauche. */
  planTexte: string | null;
  planV2Texte: string | null;
  running: boolean;
  runningPhase: string | null;
  runs: ControleRunRow[];
  /** La réponse BRUTE du dernier contrôleur, avant tout parsing. */
  reponseBrute: string | null;
};

export const planControlState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<ControleEtat> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: step } = await admin
      .from("book_steps")
      .select("id, book_id, step_code, lang")
      .eq("id", data.bookStepId)
      .maybeSingle();

    const vide: ControleEtat = {
      isPlanStep: false,
      enabled: false,
      mode: "A",
      maxIterations: 1,
      manques: [],
      hasPlan: false,
      planVersion: null,
      planTexte: null,
      planV2Texte: null,
      reponseBrute: null,
      running: false,
      runningPhase: null,
      runs: [],
    };
    if (!step || step.step_code !== "plan") return vide;

    const { data: reglages } = await admin
      .from("plan_control_settings")
      .select("enabled, mode, max_iterations")
      .eq("id", true)
      .maybeSingle();
    const mode = (reglages?.mode ?? "A") as ModeControle;

    const [methode, regles, correctif] = await Promise.all([
      promptDuRole(editor, "plan", "methode_controle"),
      promptDuRole(editor, "plan", "regles_controle"),
      promptDuRole(editor, "plan", "redaction_corrective"),
    ]);
    const manques: string[] = [];
    if (!methode || promptVide(methode.content)) manques.push("Le prompt Plan × Méthode (contrôle) est vide ou absent.");
    if (!regles || promptVide(regles.content)) manques.push("Le prompt Plan × Règles de contrôle est vide ou absent.");
    if (mode !== "A" && (!correctif || promptVide(correctif.content)))
      manques.push("Le prompt Plan × Rédaction corrective est vide ou absent.");

    const { data: plans } = await admin
      .from("artifacts")
      .select("id, version, storage_path")
      .eq("book_step_id", step.id)
      .eq("type", "plan")
      .order("version", { ascending: false })
      .limit(2);

    const { data: runs } = await admin
      .from("plan_control_runs")
      .select(
        "id, mode, status, phase, plan_version, verdicts, notes, propositions, moyenne, controleur_model_used, redacteur_model_used, duration_ms, error, created_at, plan_v2_artifact_id, report_artifact_id, controleur_run_id",
      )
      .eq("book_step_id", step.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const dernier = runs?.[0];
    const running = dernier?.status === "en_cours";

    // Le plan courant, et le plan v1 sous lui quand une correction a été déposée.
    let planTexte: string | null = null;
    let planV2Texte: string | null = null;
    const courant = plans?.[0];
    const precedent = plans?.[1];
    const corrigeEstCourant =
      dernier?.status === "termine" && dernier.plan_v2_artifact_id !== null && courant?.id === dernier.plan_v2_artifact_id;
    try {
      if (corrigeEstCourant && precedent) {
        planTexte = (await downloadArtifactText(editor, precedent.storage_path)).text;
        planV2Texte = (await downloadArtifactText(editor, courant.storage_path)).text;
      } else if (courant) {
        planTexte = (await downloadArtifactText(editor, courant.storage_path)).text;
      }
    } catch {
      // La lecture du coffre ne doit jamais éteindre l'écran : le volet dira « — ».
      planTexte = planTexte ?? null;
    }

    // La réponse brute du dernier contrôleur : conservée avant tout parsing,
    // consultable même quand le contrôle est non exploitable.
    let reponseBrute: string | null = null;
    if (dernier?.controleur_run_id) {
      const { data: brutes } = await admin
        .from("artifacts")
        .select("storage_path")
        .eq("book_step_id", step.id)
        .eq("type", "reponse_brute")
        .eq("robot_run_id", dernier.controleur_run_id)
        .order("version", { ascending: false })
        .limit(1);
      const chemin = brutes?.[0]?.storage_path;
      if (chemin) {
        try {
          reponseBrute = (await downloadArtifactText(editor, chemin)).text;
        } catch {
          reponseBrute = null;
        }
      }
    }

    return {

      isPlanStep: true,
      enabled: reglages?.enabled ?? false,
      mode,
      maxIterations: reglages?.max_iterations ?? 1,
      manques,
      hasPlan: (plans ?? []).length > 0,
      planVersion: corrigeEstCourant ? (precedent?.version ?? null) : (courant?.version ?? null),
      planTexte,
      planV2Texte,
      running,
      runningPhase: running ? (dernier?.phase ?? null) : null,
      runs: (runs ?? []).map((r) => ({
        id: r.id,
        mode: r.mode as ModeControle,
        status: r.status,
        phase: r.phase ?? null,
        planVersion: r.plan_version ?? null,
        verdicts: (r.verdicts as VerdictLigne[] | null) ?? null,
        notes: (r.notes as Notes | null) ?? null,
        propositions: ((r.propositions as VerdictLigne[] | null) ?? []) as VerdictLigne[],
        moyenne: r.moyenne === null ? null : Number(r.moyenne),
        controleurModelUsed: r.controleur_model_used ?? null,
        redacteurModelUsed: r.redacteur_model_used ?? null,
        durationMs: r.duration_ms ?? null,
        error: r.error ?? null,
        createdAt: r.created_at,
        planV2ArtifactId: r.plan_v2_artifact_id ?? null,
        reportArtifactId: r.report_artifact_id ?? null,
        attendus:
          ((r.verdicts as VerdictLigne[] | null) ?? []).filter((v) => v.source === "modele").length || null,

      })),
    };
  });

/** Le lancement. Long : l'écran suit tout seul pendant ce temps. */
export const launchPlanControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<ResultatControle> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return executerControlePlan(editor, { bookStepId: data.bookStepId });
  });

/**
 * GARDER LE PLAN V1 — le plan d'avant la correction redevient le plan courant.
 * Rien n'est supprimé : il est re-déposé en version suivante, de ma main.
 */
export const keepPlanV1 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ version: number }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: step } = await admin
      .from("book_steps")
      .select("id, book_id, step_code, lang")
      .eq("id", data.bookStepId)
      .maybeSingle();
    if (!step) throw new Error("Étape introuvable.");

    const { data: plans } = await admin
      .from("artifacts")
      .select("id, version, storage_path")
      .eq("book_step_id", step.id)
      .eq("type", "plan")
      .order("version", { ascending: false })
      .limit(2);
    const courant = plans?.[0];
    const precedent = plans?.[1];
    if (!courant || !precedent)
      throw new Error("Il n'y a pas de plan précédent à remettre en avant sur cette étape.");

    const { text } = await downloadArtifactText(editor, precedent.storage_path);
    const version = courant.version + 1;
    const storagePath = artifactPath({
      bookId: step.book_id,
      stepCode: step.step_code,
      lang: step.lang,
      type: "plan",
      version,
      fileName: `plan-v${version}.md`,
    });
    const bytes = new TextEncoder().encode(text).buffer as ArrayBuffer;
    await uploadArtifactBytes(editor, storagePath, bytes, "text/markdown; charset=utf-8");
    const { error } = await admin.from("artifacts").insert({
      book_step_id: step.id,
      type: "plan",
      version,
      storage_path: storagePath,
      checksum: await sha256Hex(bytes),
      size_bytes: bytes.byteLength,
      origin: "ben",
      plan_version: version,
      created_by: editor.userId,
    });
    if (error) throw new Error(texteErreurBase("Le plan précédent n'a pas pu être remis en avant", error));
    return { version };
  });

/**
 * LE PLAN CORRIGÉ À LA MAIN (mode A) — le volet de gauche est éditable :
 * enregistrer dépose une nouvelle version du plan, de ma main.
 */
export const savePlanText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ bookStepId: z.string().uuid(), texte: z.string().trim().min(1) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ version: number }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: step } = await admin
      .from("book_steps")
      .select("id, book_id, step_code, lang")
      .eq("id", data.bookStepId)
      .maybeSingle();
    if (!step) throw new Error("Étape introuvable.");

    const { data: last } = await admin
      .from("artifacts")
      .select("version")
      .eq("book_step_id", step.id)
      .eq("type", "plan")
      .order("version", { ascending: false })
      .limit(1);
    const version = (last?.[0]?.version ?? 0) + 1;
    const storagePath = artifactPath({
      bookId: step.book_id,
      stepCode: step.step_code,
      lang: step.lang,
      type: "plan",
      version,
      fileName: `plan-v${version}.md`,
    });
    const bytes = new TextEncoder().encode(data.texte).buffer as ArrayBuffer;
    await uploadArtifactBytes(editor, storagePath, bytes, "text/markdown; charset=utf-8");
    const { error } = await admin.from("artifacts").insert({
      book_step_id: step.id,
      type: "plan",
      version,
      storage_path: storagePath,
      checksum: await sha256Hex(bytes),
      size_bytes: bytes.byteLength,
      origin: "ben",
      plan_version: version,
      created_by: editor.userId,
    });
    if (error) throw new Error(texteErreurBase("Le plan corrigé à la main n'a pas pu être déposé", error));
    return { version };
  });

/* ------------------------------------------------------------------ */
/* LE TABLEAU DE MESURE                                                */
/* ------------------------------------------------------------------ */

export type MesureLigne = {
  id: string;
  bookTitle: string;
  createdAt: string;
  mode: ModeControle;
  status: string;
  planVersion: number | null;
  notes: Notes | null;
  moyenne: number | null;
  propositions: number;
  controleurModelUsed: string | null;
  redacteurModelUsed: string | null;
};

export const planControlMeasures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MesureLigne[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data: runs } = await admin
      .from("plan_control_runs")
      .select(
        "id, book_id, created_at, mode, status, plan_version, notes, moyenne, propositions, controleur_model_used, redacteur_model_used",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    const bookIds = [...new Set((runs ?? []).map((r) => r.book_id))];
    const books = bookIds.length
      ? (await admin.from("books").select("id, title_fr").in("id", bookIds)).data ?? []
      : [];
    return (runs ?? []).map((r) => ({
      id: r.id,
      bookTitle: books.find((b) => b.id === r.book_id)?.title_fr ?? "—",
      createdAt: r.created_at,
      mode: r.mode as ModeControle,
      status: r.status,
      planVersion: r.plan_version ?? null,
      notes: (r.notes as Notes | null) ?? null,
      moyenne: r.moyenne === null ? null : Number(r.moyenne),
      propositions: ((r.propositions as VerdictLigne[] | null) ?? []).length,
      controleurModelUsed: r.controleur_model_used ?? null,
      redacteurModelUsed: r.redacteur_model_used ?? null,
    }));
  });
