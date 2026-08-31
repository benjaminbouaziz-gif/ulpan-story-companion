import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { texteErreurBase } from "./db-error";
import { cleConfiguree, fournisseurDuModele, secretDuModele } from "./robot-provider.server";
import {
  enchainerApresValidation,
  executerLancementPlan,
  type MaillonEnchaine,
} from "./atelier-robot-run.server";

/**
 * BRIQUE 6 — LE PREMIER ROBOT : « Plan de chapitres ».
 *
 * Un seul robot, une seule étape ('plan'). Ce qui part au modèle : le contenu
 * de la VERSION ACTIVE du prompt, puis la matière du livre lue en base — rien
 * d'inventé, rien d'ajouté. Ni l'envoi ni la réponse ne sont journalisés :
 * seuls comptent l'artefact déposé et la ligne d'agent_runs.
 *
 * GARDE-FOUS :
 *  - un seul lancement à la fois par étape : garanti en base par l'index unique
 *    partiel sur agent_runs (book_step_id) où status = 'en_cours' — un double
 *    clic échoue à l'insert, jamais après l'appel ;
 *  - la clé d'idempotence identifie LA TENTATIVE (étape + horodatage), jamais
 *    le résultat : un échec ne verrouille plus l'étape pour toujours ;
 *  - aucun artefact n'est créé quand l'appel échoue.
 */


export const ROBOT_PLAN = "plan";
export const PLAN_STEP_CODE = "plan";
/** Au-delà de ce délai, un lancement resté « en cours » est tenu pour abandonné. */
export const DELAI_ABANDON_MS = 15 * 60 * 1000;

export type PlanRobotState = {
  stepCode: string;
  isPlanStep: boolean;
  promptName: string | null;
  promptVersion: number | null;
  model: string | null;
  webSearch: boolean;
  provider: string | null;
  secretName: string | null;
  keyConfigured: boolean;
  summaryFilled: boolean;
  running: boolean;
  /** Depuis quand le lancement en cours tourne, et avec quoi. */
  runningSince: string | null;
  runningRobot: string | null;
  runningModel: string | null;
  /** Vrai quand ce lancement traîne au-delà du délai d'abandon. */
  runningStale: boolean;
  hasPrevious: boolean;
  /** Décisions vivantes de l'étape : ce que « Repartir de zéro » archivera. */
  liveDecisions: number;
  inRevision: boolean;
  lastReason: string | null;
  /** Ce qui manque, en français, prêt à afficher. Vide = prêt à lancer. */
  missing: string[];
  lastRun: {
    status: string | null;
    modelUsed: string | null;
    durationMs: number | null;
    errorSummary: string | null;
    createdAt: string;
  } | null;
};

/**
 * LE BALAI DES LANCEMENTS MORTS. Un onglet fermé, une coupure, un serveur
 * redémarré : la ligne reste « en cours » et l'index d'unicité interdit tout
 * nouveau lancement. Au-delà du délai, on la clôt en échec et l'étape
 * redevient lançable. Appelé au chargement du dossier, côté serveur.
 */
async function balayerLancementsMorts(
  admin: Awaited<ReturnType<typeof getAdminClient>>,
  stepId: string,
): Promise<void> {
  const limite = new Date(Date.now() - DELAI_ABANDON_MS).toISOString();
  const { data: morts } = await admin
    .from("agent_runs")
    .select("id")
    .eq("book_step_id", stepId)
    .eq("status", "en_cours")
    .lt("created_at", limite);
  if (!morts || morts.length === 0) return;

  await admin
    .from("agent_runs")
    .update({
      status: "echoue",
      ok: false,
      error: "lancement interrompu",
      error_summary: "lancement interrompu",
    })
    .in(
      "id",
      morts.map((r) => r.id),
    );

  const { data: step } = await admin
    .from("book_steps")
    .select("status")
    .eq("id", stepId)
    .maybeSingle();
  if (step?.status === "en_cours")
    await admin
      .from("book_steps")
      .update({ status: "echoue", awaiting: "ben", updated_at: new Date().toISOString() })
      .eq("id", stepId);
}

/** Le déblocage à la main, quand un lancement traîne au-delà du délai. */
export const unblockPlanStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ freed: boolean }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const limite = new Date(Date.now() - DELAI_ABANDON_MS).toISOString();
    const { data: morts } = await admin
      .from("agent_runs")
      .select("id")
      .eq("book_step_id", data.bookStepId)
      .eq("status", "en_cours")
      .lt("created_at", limite);
    if (!morts || morts.length === 0)
      throw new Error("Aucun lancement abandonné à débloquer sur cette étape.");
    await balayerLancementsMorts(admin, data.bookStepId);
    return { freed: true };
  });

/** Arrêt explicite : clôt le lancement immédiatement, quel que soit son âge. */
export const cancelPlanRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ stopped: boolean }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data: runs, error } = await admin
      .from("agent_runs")
      .update({
        status: "echoue",
        ok: false,
        error: "lancement arrêté manuellement",
        error_summary: "lancement arrêté manuellement",
      })
      .eq("book_step_id", data.bookStepId)
      .eq("status", "en_cours")
      .select("id");
    if (error) throw new Error(texteErreurBase("L'arrêt du lancement a échoué", error));
    if (!runs || runs.length === 0) throw new Error("Aucun lancement en cours à arrêter.");
    await admin
      .from("book_steps")
      .update({ status: "echoue", awaiting: "ben", updated_at: new Date().toISOString() })
      .eq("id", data.bookStepId);
    return { stopped: true };
  });


/** L'état du robot pour une étape : sert à dire ce qui manque AVANT de lancer. */
export const planRobotState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<PlanRobotState | null> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: step } = await admin
      .from("book_steps")
      .select("id, book_id, step_code, status")
      .eq("id", data.bookStepId)
      .maybeSingle();
    if (!step) return null;

    // Le balai d'abord : un lancement mort ne doit jamais bloquer l'étape.
    await balayerLancementsMorts(admin, step.id);

    const isPlanStep = step.step_code === PLAN_STEP_CODE;


    const [{ data: book }, { data: prompt }, { data: runs }, { data: arts }, { data: revs }] =
      await Promise.all([
        admin.from("books").select("work_summary_fr").eq("id", step.book_id).maybeSingle(),
        admin
          .from("prompts")
          .select("id, name, active_version_id")
          .eq("step_code", PLAN_STEP_CODE)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        admin
          .from("agent_runs")
          .select("status, model, model_used, duration_ms, error_summary, created_at, robot_name")
          .eq("book_step_id", step.id)
          .order("created_at", { ascending: false }),
        admin
          .from("artifacts")
          .select("id, version")
          .eq("book_step_id", step.id)
          .eq("type", "plan")
          .order("version", { ascending: false })
          .limit(1),
        admin
          .from("reviews")
          .select("comment, decision, created_at")
          .eq("book_step_id", step.id)
          .eq("decision", "revision_demandee")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    let version: { version: number; model: string | null; web_search: boolean } | null = null;
    if (prompt?.active_version_id) {
      const { data: v } = await admin
        .from("prompt_versions")
        .select("version, model, web_search")
        .eq("id", prompt.active_version_id)
        .maybeSingle();
      version = v ?? null;
    }

    // Ce que « Repartir de zéro » mettra de côté : on le NOMME au bouton.
    const { count: liveDecisions } = await admin
      .from("book_decisions")
      .select("id", { count: "exact", head: true })
      .eq("book_step_id", step.id)
      .is("archived_at", null);


    const model = version?.model ?? null;
    const summaryFilled = (book?.work_summary_fr ?? "").trim().length > 0;
    const keyConfigured = model ? cleConfiguree(model) : false;
    const enCours = (runs ?? []).find((r) => r.status === "en_cours") ?? null;
    const running = enCours !== null;
    const runningStale =
      enCours !== null && Date.now() - new Date(enCours.created_at).getTime() > DELAI_ABANDON_MS;


    const missing: string[] = [];
    if (!isPlanStep) missing.push("Ce robot ne travaille que sur l'étape « Plan de chapitres ».");
    if (!summaryFilled)
      missing.push("Il manque le résumé de l'éditeur dans la fiche du livre.");
    if (!prompt) missing.push("Il manque un prompt pour l'étape « Plan de chapitres ».");
    else if (!version) missing.push("Le prompt de l'étape n'a aucune version active.");
    else if (!model)
      missing.push("La version active du prompt ne précise aucun modèle : republiez-la avec un modèle.");
    else if (!fournisseurDuModele(model))
      missing.push(`Modèle inconnu de l'atelier : « ${model} » (claude-…, gemini-…, google/gemini-…).`);
    else if (!keyConfigured)
      missing.push(`Il manque la clé d'API ${secretDuModele(model)} dans les secrets du projet.`);
    if (running) missing.push("Un lancement est déjà en cours sur cette étape.");

    const last = (runs ?? [])[0] ?? null;

    return {
      stepCode: step.step_code,
      isPlanStep,
      promptName: prompt?.name ?? null,
      promptVersion: version?.version ?? null,
      model,
      webSearch: version?.web_search ?? false,
      provider: model ? fournisseurDuModele(model) : null,
      secretName: model ? secretDuModele(model) : null,
      keyConfigured,
      summaryFilled,
      running,
      runningSince: enCours?.created_at ?? null,
      runningRobot: enCours?.robot_name ?? null,
      runningModel: enCours?.model ?? enCours?.model_used ?? null,
      runningStale,
      hasPrevious: (arts ?? []).length > 0,
      liveDecisions: liveDecisions ?? 0,
      inRevision: step.status === "en_revision",
      lastReason: revs?.[0]?.comment ?? null,
      missing,
      lastRun: last
        ? {
            status: last.status ?? null,
            modelUsed: last.model_used ?? null,
            durationMs: last.duration_ms ?? null,
            errorSummary: last.error_summary ?? null,
            createdAt: last.created_at,
          }
        : null,
    };
  });

/**
 * Le lancement, au clic. Le travail lui-même vit dans atelier-robot-run.server
 * pour être appelable aussi par l'enchaînement d'après validation.
 */
export const launchPlanRobot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bookStepId: z.string().uuid(),
        withReason: z.boolean().optional(),
        /** 'sans_precedent' = repartir de zéro : ni plan précédent, ni motif. */
        mode: z.enum(["avec_precedent", "sans_precedent"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ artifactVersion: number; modelUsed: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return executerLancementPlan(editor, data);
  });

/**
 * L'ENCHAÎNEMENT : appelé juste après une validation. Il lance l'étape suivante
 * si c'est un robot outillé, continue de proche en proche, et s'arrête en le
 * disant à la première étape humaine, au premier échec ou faute de prompt.
 */
export const chainAfterValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<MaillonEnchaine[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return enchainerApresValidation(editor, data.bookStepId);
  });


export type RobotRunLine = {
  id: string;
  createdAt: string;
  bookTitle: string | null;
  stepLabel: string | null;
  robot: string | null;
  model: string | null;
  status: string | null;
  durationMs: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  truncated: boolean;
  errorSummary: string | null;
  mode: string | null;
};

/** L'historique des lancements, pour la salle Robots. Rien de décoratif. */
export const listRobotRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RobotRunLine[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data: runs } = await admin
      .from("agent_runs")
      .select(
        "id, created_at, robot_name, model, model_used, status, duration_ms, output_tokens, cost_usd, truncated, error_summary, book_step_id, mode",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    const lignes = runs ?? [];
    const stepIds = [...new Set(lignes.map((r) => r.book_step_id).filter((v): v is string => !!v))];
    const titres = new Map<string, string>();
    const etapes = new Map<string, string>();
    if (stepIds.length > 0) {
      const { data: steps } = await admin
        .from("book_steps")
        .select("id, book_id, label_fr")
        .in("id", stepIds);
      const bookIds = [...new Set((steps ?? []).map((s) => s.book_id))];
      const { data: books } = await admin.from("books").select("id, title_fr").in("id", bookIds);
      const parLivre = new Map((books ?? []).map((b) => [b.id, b.title_fr]));
      for (const s of steps ?? []) {
        titres.set(s.id, parLivre.get(s.book_id) ?? "—");
        etapes.set(s.id, s.label_fr);
      }
    }
    return lignes.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      bookTitle: r.book_step_id ? (titres.get(r.book_step_id) ?? null) : null,
      stepLabel: r.book_step_id ? (etapes.get(r.book_step_id) ?? null) : null,
      robot: r.robot_name,
      model: r.model_used ?? r.model,
      status: r.status,
      durationMs: r.duration_ms,
      outputTokens: r.output_tokens,
      costUsd: r.cost_usd === null || r.cost_usd === undefined ? null : Number(r.cost_usd),
      truncated: r.truncated ?? false,
      errorSummary: r.error_summary,
      mode: r.mode ?? null,
    }));
  });
