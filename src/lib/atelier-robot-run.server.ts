import type { EditorContext } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { artifactPath } from "./artifact-path";
import { downloadArtifactText, sha256Hex, uploadArtifactBytes } from "./atelier-artifacts.server";
import {
  archiverDecisionsDeLEtape,
  blocDecisionsPourRobot,
  synchroniserDecisions,
} from "./decisions.server";
import { texteErreurBase, violeIndex } from "./db-error";
import { appelerModele, cleConfiguree, fournisseurDuModele, secretDuModele } from "./robot-provider.server";

/**
 * LE LANCEMENT DU ROBOT « PLAN DE CHAPITRES », ET L'ENCHAÎNEMENT.
 *
 * Ce fichier ne contient AUCUNE fonction serveur : seulement le travail,
 * appelable aussi bien par un clic (launchPlanRobot) que par une validation
 * d'étape (enchainerApresValidation).
 *
 * GARDE-FOUS QUI RESTENT :
 *  - un seul lancement à la fois par étape (index unique partiel en base) ;
 *  - aucun artefact quand l'appel échoue.
 * Il n'y a PLUS de plafond de lancements par jour : la dépense se borne chez
 * le fournisseur, et l'arrêt se fait au bouton.
 */

export const ROBOT_PLAN = "plan";
export const PLAN_STEP_CODE = "plan";

export type ModeLancement = "avec_precedent" | "sans_precedent" | "enchainement";

export async function executerLancementPlan(
  editor: EditorContext,
  data: { bookStepId: string; withReason?: boolean | undefined; mode?: ModeLancement | undefined },
): Promise<{ artifactVersion: number; modelUsed: string }> {
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
  if (!fournisseurDuModele(model)) throw new Error(`Modèle inconnu de l'atelier : « ${model} ».`);
  if (!cleConfiguree(model))
    throw new Error(`Il manque la clé d'API ${secretDuModele(model)} dans les secrets du projet.`);

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
    ? ((await admin.from("collections").select("name_fr").eq("id", book.collection_id).maybeSingle())
        .data?.name_fr ?? null)
    : null;

  // Le mode dit ce qui part avec le prompt. « Repartir de zéro » n'emporte ni
  // le plan précédent ni le motif ; l'enchaînement non plus : il part du prompt
  // actif, des données du livre et de mes décisions tranchées.
  const enchainement = data.mode === "enchainement";
  const fromScratch = data.mode === "sans_precedent";
  const avecPrecedent = !fromScratch && !enchainement && (data.withReason ?? false);
  const mode: "initial" | "avec_precedent" | "sans_precedent" | "enchainement" = enchainement
    ? "enchainement"
    : fromScratch
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
    if (!path) throw new Error("Le plan précédent est introuvable dans le coffre.");
    const downloaded = await downloadArtifactText(editor, path);
    previousPlan = downloaded.text;
    if (previousPlan.trim().length === 0) throw new Error("Le plan précédent est vide.");
  }

  // 1) La ligne de lancement d'abord : c'est elle qui interdit le second clic.
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
    if (violeIndex(runErr, "agent_runs_un_seul_en_cours_par_etape"))
      throw new Error("Un lancement est déjà en cours sur cette étape.");
    throw new Error(texteErreurBase("Le lancement n'a pas pu être enregistré", runErr));
  }

  await admin
    .from("book_steps")
    .update({ status: "en_cours", awaiting: "robot", updated_at: new Date().toISOString() })
    .eq("id", step.id);

  /**
   * REPARTIR DE ZÉRO — les questions du plan abandonné n'ont plus d'objet :
   * elles sont archivées AVANT l'appel, avec la version du plan qui les avait
   * produites. Rien n'est détruit.
   */
  if (fromScratch) {
    await archiverDecisionsDeLEtape(editor, {
      bookStepId: step.id,
      fromVersion: lastArt?.[0]?.version ?? null,
    });
  }

  const blocDecisions = await blocDecisionsPourRobot(editor, book.id);

  // 2) L'appel. Le contenu envoyé n'est écrit nulle part.
  const matiere = [
    `Titre de travail : ${book.title_fr}`,
    `Collection : ${collection ?? "non renseignée"}`,
    `Résumé de l'éditeur :\n${book.work_summary_fr}`,
    (book.book_constraints_fr ?? "").trim().length > 0
      ? `Consignes propres au livre :\n${book.book_constraints_fr}`
      : null,
    (book.intent_note_fr ?? "").trim().length > 0 ? `Ton et angle :\n${book.intent_note_fr}` : null,
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
      // Dès que le flux fait avancer la réponse, on inscrit le modèle employé :
      // un lancement dont `model_used` reste vide est donc un lancement qui n'a
      // JAMAIS reçu le premier événement, et cela se lit maintenant sans doute.
      onProgress: async (info) => {
        await admin
          .from("agent_runs")
          .update({ model_used: info.modelUsed })
          .eq("id", run.id)
          .eq("status", "en_cours");
      },
    });
    if (result.text.trim().length === 0) throw new Error("Le modèle a répondu sans contenu.");
    if (result.truncated) throw new Error("la réponse a été coupée : plafond de longueur atteint");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("agent_runs")
      .update({
        status: "echoue",
        ok: false,
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

  // Un arrêt manuel peut intervenir pendant l'appel distant : la réponse
  // tardive est alors ignorée et aucun livrable n'est déposé.
  const { data: currentRun } = await admin
    .from("agent_runs")
    .select("status")
    .eq("id", run.id)
    .maybeSingle();
  if (currentRun?.status !== "en_cours") throw new Error("Le lancement a été arrêté.");

  // 3) Le dépôt : octets d'abord, ligne ensuite (comme tout artefact).
  try {
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

    await synchroniserDecisions(editor, {
      bookId: step.book_id,
      bookStepId: step.id,
      markdown: result.text,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("agent_runs")
      .update({
        status: "echoue",
        ok: false,
        model_used: result.modelUsed,
        error: message.slice(0, 2000),
        error_summary: message.slice(0, 300),
        duration_ms: Date.now() - startedAt,
        input_chars: version.content.length + matiere.length,
        output_chars: result.text.length,
        output_tokens: result.outputTokens,
        input_tokens: result.inputTokens,
        truncated: result.truncated,
      })
      .eq("id", run.id)
      .eq("status", "en_cours");
    await admin
      .from("book_steps")
      .update({ status: "echoue", awaiting: "ben", updated_at: new Date().toISOString() })
      .eq("id", step.id);
    throw new Error(message);
  }

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
}

/* ------------------------------------------------------------------ */
/* L'ENCHAÎNEMENT APRÈS VALIDATION                                     */
/* ------------------------------------------------------------------ */

export type EtapeSuivante = {
  stepId: string;
  labelFr: string;
  species: string;
  status: string;
  /** Vrai quand une validation la lancera d'elle-même. */
  autoLaunch: boolean;
  /** Pourquoi elle ne partira pas, en clair. Null quand elle part. */
  raison: string | null;
};

/** L'étape juste après celle-ci, par rang, et ce qu'il advient d'elle. */
export async function etapeSuivante(
  editor: EditorContext,
  bookStepId: string,
): Promise<EtapeSuivante | null> {
  const admin = await getAdminClient(editor);
  const { data: courante } = await admin
    .from("book_steps")
    .select("id, book_id, lang, rank")
    .eq("id", bookStepId)
    .maybeSingle();
  if (!courante) return null;

  const { data: suivantes } = await admin
    .from("book_steps")
    .select("id, label_fr, species, status, step_code, rank")
    .eq("book_id", courante.book_id)
    .eq("lang", courante.lang)
    .gt("rank", courante.rank)
    .order("rank", { ascending: true })
    .limit(1);
  const suivante = suivantes?.[0];
  if (!suivante) return null;

  const base = {
    stepId: suivante.id,
    labelFr: suivante.label_fr,
    species: suivante.species,
    status: suivante.status,
  };

  if (suivante.species !== "llm")
    return { ...base, autoLaunch: false, raison: `L'étape suivante « ${suivante.label_fr} » vous attend.` };
  if (suivante.status === "valide" || suivante.status === "valide_hors_crm")
    return { ...base, autoLaunch: false, raison: `L'étape suivante « ${suivante.label_fr} » est déjà validée.` };
  if (suivante.step_code !== PLAN_STEP_CODE)
    return {
      ...base,
      autoLaunch: false,
      raison: `Aucun robot n'existe encore pour l'étape « ${suivante.label_fr} ».`,
    };

  const { data: prompt } = await admin
    .from("prompts")
    .select("active_version_id")
    .eq("step_code", suivante.step_code)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!prompt?.active_version_id)
    return {
      ...base,
      autoLaunch: false,
      raison: `Aucun prompt actif pour l'étape « ${suivante.label_fr} » : rien n'a été lancé.`,
    };
  const { data: version } = await admin
    .from("prompt_versions")
    .select("model")
    .eq("id", prompt.active_version_id)
    .maybeSingle();
  const model = (version?.model ?? "").trim();
  if (model.length === 0)
    return {
      ...base,
      autoLaunch: false,
      raison: `La version active du prompt de « ${suivante.label_fr} » ne précise aucun modèle : rien n'a été lancé.`,
    };

  return { ...base, autoLaunch: true, raison: null };
}

export type MaillonEnchaine = { stepLabel: string; ok: boolean; message: string };

/**
 * De proche en proche : tant que l'étape suivante est un robot outillé, elle
 * part. On s'arrête à la première étape humaine ou déterministe — celles-là
 * m'attendent — et au premier échec, sans jamais insister.
 */
export async function enchainerApresValidation(
  editor: EditorContext,
  bookStepId: string,
): Promise<MaillonEnchaine[]> {
  const maillons: MaillonEnchaine[] = [];
  let depuis = bookStepId;

  for (let garde = 0; garde < 10; garde += 1) {
    const suivante = await etapeSuivante(editor, depuis);
    if (!suivante) {
      maillons.push({ stepLabel: "—", ok: true, message: "Fin de la chaîne : aucune étape suivante." });
      return maillons;
    }
    if (!suivante.autoLaunch) {
      maillons.push({
        stepLabel: suivante.labelFr,
        ok: true,
        message: suivante.raison ?? `L'étape suivante « ${suivante.labelFr} » vous attend.`,
      });
      return maillons;
    }
    try {
      const res = await executerLancementPlan(editor, {
        bookStepId: suivante.stepId,
        mode: "enchainement",
      });
      maillons.push({
        stepLabel: suivante.labelFr,
        ok: true,
        message: `Lancée automatiquement : « ${suivante.labelFr} » — livrable v${res.artifactVersion} (${res.modelUsed}), en attente de votre signature.`,
      });
    } catch (e) {
      maillons.push({
        stepLabel: suivante.labelFr,
        ok: false,
        message: `L'enchaînement s'arrête sur « ${suivante.labelFr} » : ${e instanceof Error ? e.message : String(e)}`,
      });
      return maillons;
    }
    depuis = suivante.stepId;
  }

  maillons.push({ stepLabel: "—", ok: true, message: "Enchaînement arrêté par prudence après dix étapes." });
  return maillons;
}
