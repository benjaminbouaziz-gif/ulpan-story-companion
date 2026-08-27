import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { artifactPath, ARTIFACT_BUCKET } from "./artifact-path";
import { sha256Hex, uploadArtifactBytes } from "./atelier-artifacts.server";
import { blocDecisionsPourRobot, synchroniserDecisions } from "./decisions.server";
import { texteErreurBase, violeIndex } from "./db-error";
import {
  appelerModele,
  cleConfiguree,
  fournisseurDuModele,
  secretDuModele,
} from "./robot-provider.server";

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
 *  - un plafond de lancements par jour (PLAFOND_PAR_JOUR) ;
 *  - aucun artefact n'est créé quand l'appel échoue.
 */


export const ROBOT_PLAN = "plan";
export const PLAN_STEP_CODE = "plan";
export const PLAFOND_PAR_JOUR = 20;
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
  inRevision: boolean;
  lastReason: string | null;
  runsToday: number;
  dailyCap: number;
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

function debutDeJournee(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

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

    const { count: runsToday } = await admin
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("robot_name", ROBOT_PLAN)
      .gte("created_at", debutDeJournee());

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
    if ((runsToday ?? 0) >= PLAFOND_PAR_JOUR)
      missing.push(`Plafond de ${PLAFOND_PAR_JOUR} lancements par jour atteint : réessayez demain.`);

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
      inRevision: step.status === "en_revision",
      lastReason: revs?.[0]?.comment ?? null,
      runsToday: runsToday ?? 0,
      dailyCap: PLAFOND_PAR_JOUR,
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
 * Le lancement. Le motif de révision est optionnel : quand il est là, le plan
 * précédent et le motif partent avec le prompt (« relancer avec mon motif »).
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
    const admin = await getAdminClient(editor);

    const { data: step } = await admin
      .from("book_steps")
      .select("id, book_id, step_code, lang, status")
      .eq("id", data.bookStepId)
      .maybeSingle();
    if (!step) throw new Error("Étape introuvable.");
    if (step.step_code !== PLAN_STEP_CODE)
      throw new Error("Ce robot ne travaille que sur l'étape « Plan de chapitres ».");

    const { data: book } = await admin
      .from("books")
      .select(
        "id, title_fr, collection_id, work_summary_fr, book_constraints_fr, intent_note_fr, source_material_fr",
      )
      .eq("id", step.book_id)
      .maybeSingle();
    if (!book) throw new Error("Livre introuvable.");
    if ((book.work_summary_fr ?? "").trim().length === 0)
      throw new Error("Il manque le résumé de l'éditeur dans la fiche du livre.");

    const { data: prompt } = await admin
      .from("prompts")
      .select("id, name, active_version_id")
      .eq("step_code", PLAN_STEP_CODE)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!prompt) throw new Error("Il manque un prompt pour l'étape « Plan de chapitres ».");
    if (!prompt.active_version_id) throw new Error("Le prompt de l'étape n'a aucune version active.");

    const { data: version } = await admin
      .from("prompt_versions")
      .select("id, version, content, model, web_search")
      .eq("id", prompt.active_version_id)
      .maybeSingle();
    if (!version) throw new Error("Version de prompt introuvable.");
    const model = (version.model ?? "").trim();
    if (model.length === 0)
      throw new Error("La version active du prompt ne précise aucun modèle : republiez-la avec un modèle.");
    if (!fournisseurDuModele(model))
      throw new Error(`Modèle inconnu de l'atelier : « ${model} ».`);
    if (!cleConfiguree(model))
      throw new Error(`Il manque la clé d'API ${secretDuModele(model)} dans les secrets du projet.`);

    const { count: runsToday } = await admin
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("robot_name", ROBOT_PLAN)
      .gte("created_at", debutDeJournee());
    if ((runsToday ?? 0) >= PLAFOND_PAR_JOUR)
      throw new Error(`Plafond de ${PLAFOND_PAR_JOUR} lancements par jour atteint : réessayez demain.`);

    // La version de l'artefact à venir : elle fait aussi la clé d'idempotence.
    const { data: lastArt } = await admin
      .from("artifacts")
      .select("id, version, storage_path")
      .eq("book_step_id", step.id)
      .eq("type", "plan")
      .order("version", { ascending: false })
      .limit(1);
    const artifactVersion = (lastArt?.[0]?.version ?? 0) + 1;

    const collection = book.collection_id
      ? (await admin.from("collections").select("name_fr").eq("id", book.collection_id).maybeSingle())
          .data?.name_fr ?? null
      : null;

    // Le motif de révision et le plan précédent, seulement si on relance dessus.
    // Le mode dit ce qui part avec le prompt. « Repartir de zéro » n'emporte ni
    // le plan précédent ni le motif : seules les données du livre et mes
    // décisions tranchées, qui font toujours foi.
    const fromScratch = data.mode === "sans_precedent";
    const avecPrecedent = !fromScratch && (data.withReason ?? false);
    const mode: "initial" | "avec_precedent" | "sans_precedent" = fromScratch
      ? "sans_precedent"
      : avecPrecedent
        ? "avec_precedent"
        : "initial";

    let reason: string | null = null;
    let previousPlan: string | null = null;
    if (avecPrecedent) {
      const { data: rev } = await admin
        .from("reviews")
        .select("comment")
        .eq("book_step_id", step.id)
        .eq("decision", "revision_demandee")
        .order("created_at", { ascending: false })
        .limit(1);
      reason = rev?.[0]?.comment ?? null;
      if (!reason) throw new Error("Aucun motif de révision n'a été écrit sur cette étape.");
      const path = lastArt?.[0]?.storage_path;
      if (path) {
        const { data: blob } = await admin.storage.from(ARTIFACT_BUCKET).download(path);
        previousPlan = blob ? await blob.text() : null;
      }
    }

    // 1) La ligne de lancement d'abord : c'est elle qui interdit le second clic.
    //    La clé nomme LA TENTATIVE — étape + horodatage — et non la version
    //    d'artefact à venir : un échec ne consomme plus la clé d'après.
    const startedAt = Date.now();
    const idempotencyKey = `plan:${step.id}:${new Date(startedAt).toISOString()}${mode === "initial" ? "" : `:${mode}`}`;
    const { data: run, error: runErr } = await admin
      .from("agent_runs")
      .insert({
        kind: "robot",
        robot_name: ROBOT_PLAN,
        status: "en_cours",
        entity: "book_step",
        entity_id: step.id,
        book_step_id: step.id,
        model,
        mode,
        idempotency_key: idempotencyKey,
        ok: false,
        fields: 0,
        input_chars: 0,
        output_chars: 0,
        created_by: editor.userId,
      })
      .select("id")
      .single();
    if (runErr || !run) {
      // « Déjà en cours » ne se dit que si c'est VRAIMENT le cas : l'index
      //  partiel sur (book_step_id) où status = 'en_cours' l'a refusé. Sinon,
      //  l'erreur de la base remonte telle quelle.
      if (violeIndex(runErr, "agent_runs_un_seul_en_cours_par_etape"))
        throw new Error("Un lancement est déjà en cours sur cette étape.");
      throw new Error(texteErreurBase("Le lancement n'a pas pu être enregistré", runErr));
    }

    await admin
      .from("book_steps")
      .update({ status: "en_cours", awaiting: "robot", updated_at: new Date().toISOString() })
      .eq("id", step.id);

    /**
     * BRIQUE 7 — mes arbitrages partent avec CHAQUE appel, après les données du
     * livre. Le bloc est fabriqué à un seul endroit (decisions.server.ts) : les
     * robots suivants l'appellent sans le réécrire.
     */
    const blocDecisions = await blocDecisionsPourRobot(editor, book.id);

    // 2) L'appel. Le contenu envoyé n'est écrit nulle part.
    const matiere = [
      `Titre de travail : ${book.title_fr}`,
      `Collection : ${collection ?? "non renseignée"}`,
      `Résumé de l'éditeur :\n${book.work_summary_fr}`,
      (book.book_constraints_fr ?? "").trim().length > 0
        ? `Consignes propres au livre :\n${book.book_constraints_fr}`
        : null,
      (book.intent_note_fr ?? "").trim().length > 0
        ? `Ton et angle :\n${book.intent_note_fr}`
        : null,
      (book.source_material_fr ?? "").trim().length > 0
        ? `Matière documentaire :\n${book.source_material_fr}`
        : null,
      blocDecisions,
      previousPlan ? `Plan précédent :\n${previousPlan}` : null,
      reason ? `Motif de révision de l'éditeur :\n${reason}` : null,
    ]
      .filter((s): s is string => s !== null)
      .join("\n\n");

    let result: Awaited<ReturnType<typeof appelerModele>> | undefined;
    try {
      result = await appelerModele({
        model,
        webSearch: version.web_search ?? false,
        system: version.content,
        user: matiere,
      });
      if (result.text.trim().length === 0) throw new Error("Le modèle a répondu sans contenu.");
      // Un livrable coupé qui passe pour complet est pire qu'un échec.
      if (result.truncated) throw new Error("la réponse a été coupée : plafond de longueur atteint");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await admin
        .from("agent_runs")
        .update({
          status: "echoue",
          ok: false,
          // Je dois savoir à qui on a parlé même quand ça a raté.
          model_used: result?.modelUsed ?? model,
          error: message.slice(0, 2000),
          error_summary: message.slice(0, 300),
          duration_ms: Date.now() - startedAt,
          input_chars: version.content.length + matiere.length,
          output_chars: result?.text.length ?? 0,
          output_tokens: result?.outputTokens ?? null,
          input_tokens: result?.inputTokens ?? null,
          truncated: result?.truncated ?? false,
        })
        .eq("id", run.id);
      await admin
        .from("book_steps")
        .update({ status: "echoue", awaiting: "ben", updated_at: new Date().toISOString() })
        .eq("id", step.id);
      throw new Error(message);
    }


    if (!result) throw new Error("Le lancement n'a rien produit.");

    // 3) Le dépôt : octets d'abord, ligne ensuite (comme tout artefact).

    const fileName = `plan-v${artifactVersion}.md`;
    const storagePath = artifactPath({
      bookId: step.book_id,
      stepCode: step.step_code,
      lang: step.lang,
      type: "plan",
      version: artifactVersion,
      fileName,
    });
    const bytes = new TextEncoder().encode(result.text).buffer as ArrayBuffer;
    await uploadArtifactBytes(editor, storagePath, bytes, "text/markdown; charset=utf-8");
    const checksum = await sha256Hex(bytes);

    const { error: artErr } = await admin.from("artifacts").insert({
      book_step_id: step.id,
      type: "plan",
      version: artifactVersion,
      storage_path: storagePath,
      checksum,
      size_bytes: bytes.byteLength,
      origin: "robot",
      robot_run_id: run.id,
      prompt_version_id: version.id,
      created_by: editor.userId,
    });
    if (artErr) throw new Error(texteErreurBase("Dépôt du plan refusé", artErr));

    /**
     * BRIQUE 7 — JUSTE APRÈS le dépôt : les « Points à trancher » deviennent des
     * décisions ouvertes, sans un clic. Une lecture impossible n'est pas un
     * silence : elle est marquée et dite dans le dossier de l'étape.
     */
    await synchroniserDecisions(editor, {
      bookId: step.book_id,
      bookStepId: step.id,
      markdown: result.text,
    });

    await admin
      .from("agent_runs")
      .update({
        status: "termine",
        ok: true,
        model_used: result.modelUsed,
        cost_usd: result.costUsd,
        duration_ms: Date.now() - startedAt,
        input_chars: version.content.length + matiere.length,
        output_chars: result.text.length,
        output_tokens: result.outputTokens,
        input_tokens: result.inputTokens,
        truncated: false,
        fields: 1,
      })
      .eq("id", run.id);

    await admin
      .from("book_steps")
      .update({
        status: "attend_validation",
        awaiting: "ben",
        updated_at: new Date().toISOString(),
      })
      .eq("id", step.id);

    return { artifactVersion, modelUsed: result.modelUsed };
  });

export type RobotRunLine = {
  id: string;
  createdAt: string;
  bookTitle: string | null;
  robot: string | null;
  model: string | null;
  status: string | null;
  durationMs: number | null;
  outputTokens: number | null;
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
        "id, created_at, robot_name, model, model_used, status, duration_ms, output_tokens, truncated, error_summary, book_step_id, mode",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    const lignes = runs ?? [];
    const stepIds = [...new Set(lignes.map((r) => r.book_step_id).filter((v): v is string => !!v))];
    const titres = new Map<string, string>();
    if (stepIds.length > 0) {
      const { data: steps } = await admin
        .from("book_steps")
        .select("id, book_id")
        .in("id", stepIds);
      const bookIds = [...new Set((steps ?? []).map((s) => s.book_id))];
      const { data: books } = await admin.from("books").select("id, title_fr").in("id", bookIds);
      const parLivre = new Map((books ?? []).map((b) => [b.id, b.title_fr]));
      for (const s of steps ?? []) titres.set(s.id, parLivre.get(s.book_id) ?? "—");
    }
    return lignes.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      bookTitle: r.book_step_id ? (titres.get(r.book_step_id) ?? null) : null,
      robot: r.robot_name,
      model: r.model_used ?? r.model,
      status: r.status,
      durationMs: r.duration_ms,
      outputTokens: r.output_tokens,
      truncated: r.truncated ?? false,
      errorSummary: r.error_summary,
      mode: r.mode ?? null,
    }));
  });
