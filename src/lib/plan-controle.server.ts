import type { EditorContext } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { artifactPath } from "./artifact-path";
import { downloadArtifactText, sha256Hex, uploadArtifactBytes } from "./atelier-artifacts.server";
import { texteErreurBase } from "./db-error";
import { appelerModele, cleConfiguree, secretDuModele } from "./robot-provider.server";
import { MODELE_IDS, promptVide, type ModeControle } from "./atelier-models";

/**
 * LA BRIQUE « CONTRÔLE DU PLAN ».
 *
 * Elle s'exécute APRÈS le robot plan et AVANT la validation humaine. Elle ne
 * valide jamais rien : elle produit un rapport, et selon le mode un plan
 * corrigé. La signature reste un clic humain, sans exception.
 *
 * Trois modes :
 *   A — un seul appel : contrôleur → rapport. Rien n'est réécrit.
 *   B — deux appels en contextes vierges : contrôleur → rapport, puis
 *       rédacteur correcteur → plan v2.
 *   C — coquille : exécute un cycle B unique. Aucune convergence.
 *
 * Le modèle employé est celui du PROMPT MOTEUR de l'appel : Règles de contrôle
 * pour le contrôleur, Rédaction corrective pour le rédacteur. Les prompts de
 * rôle Méthode sont des documents joints : leur modèle n'est pas déterminant.
 *
 * Chaque appel inscrit le modèle RENVOYÉ PAR LA RÉPONSE, pas celui demandé.
 */

export const CONTROLE_STEP_CODE = "plan";

export type Verdicts = {
  structure: boolean;
  progression: boolean;
  methode: boolean;
  coherence_recit: boolean;
};

export type Notes = {
  structure: number | null;
  progression: number | null;
  methode: number | null;
  coherence_recit: number | null;
  moyenne: number | null;
};

export type Proposition = {
  chapitre: number | null;
  defaut: string;
  regle_violee: string;
  correction: string;
  gravite: "majeure" | "mineure";
};

export type RapportControle = {
  verdicts: Verdicts;
  notes: Notes;
  propositions: Proposition[];
};

/* ------------------------------------------------------------------ */
/* LECTURE DU RAPPORT — robuste, jamais fatale pour l'écran            */
/* ------------------------------------------------------------------ */

/** Enlève les clôtures ```json que les modèles ajoutent malgré la consigne. */
function nettoyerJson(brut: string): string {
  let t = brut.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) t = fence[1].trim();
  // Un modèle bavard peut encadrer le JSON de phrases : on garde l'objet.
  const debut = t.indexOf("{");
  const fin = t.lastIndexOf("}");
  if (debut > 0 || (fin >= 0 && fin < t.length - 1)) {
    if (debut >= 0 && fin > debut) t = t.slice(debut, fin + 1);
  }
  return t;
}

function nombreOuNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function booleen(v: unknown): boolean {
  return v === true;
}

/**
 * Lit le rapport. En cas de JSON invalide, l'erreur est explicite : elle est
 * inscrite au journal et l'exécution est marquée en échec — l'écran ne casse
 * jamais et le texte brut n'est pas perdu (il reste dans le livrable déposé).
 */
export function lireRapport(brut: string): RapportControle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(nettoyerJson(brut));
  } catch (e) {
    throw new Error(
      `Le rapport du contrôleur n'est pas un JSON valide : ${e instanceof Error ? e.message : String(e)}. Début de la réponse : ${brut.replace(/\s+/g, " ").slice(0, 300)}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null)
    throw new Error("Le rapport du contrôleur n'est pas un objet JSON.");

  const o = parsed as Record<string, unknown>;
  const v = (o["verdicts"] ?? {}) as Record<string, unknown>;
  const n = (o["notes"] ?? {}) as Record<string, unknown>;
  const propsBrutes = Array.isArray(o["propositions"]) ? (o["propositions"] as unknown[]) : [];

  const notes: Notes = {
    structure: nombreOuNull(n["structure"]),
    progression: nombreOuNull(n["progression"]),
    methode: nombreOuNull(n["methode"]),
    coherence_recit: nombreOuNull(n["coherence_recit"]),
    moyenne: nombreOuNull(n["moyenne"]),
  };
  if (notes.moyenne === null) {
    const q = [notes.structure, notes.progression, notes.methode, notes.coherence_recit].filter(
      (x): x is number => x !== null,
    );
    notes.moyenne = q.length > 0 ? Math.round((q.reduce((a, b) => a + b, 0) / q.length) * 100) / 100 : null;
  }

  return {
    verdicts: {
      structure: booleen(v["structure"]),
      progression: booleen(v["progression"]),
      methode: booleen(v["methode"]),
      coherence_recit: booleen(v["coherence_recit"]),
    },
    notes,
    propositions: propsBrutes.map((p) => {
      const r = (p ?? {}) as Record<string, unknown>;
      return {
        chapitre: nombreOuNull(r["chapitre"]),
        defaut: String(r["defaut"] ?? ""),
        regle_violee: String(r["regle_violee"] ?? ""),
        correction: String(r["correction"] ?? ""),
        gravite: r["gravite"] === "mineure" ? "mineure" : "majeure",
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* LES PROMPTS DU CONTRÔLE                                             */
/* ------------------------------------------------------------------ */

export type PromptResolu = {
  id: string;
  name: string;
  versionId: string;
  version: number;
  content: string;
  model: string;
  webSearch: boolean;
};

/** Le prompt actif d'un couple Étape × Rôle. Null s'il n'y en a pas. */
export async function promptDuRole(
  editor: EditorContext,
  etape: string,
  roleCode: string,
): Promise<PromptResolu | null> {
  const admin = await getAdminClient(editor);
  const { data: prompt } = await admin
    .from("prompts")
    .select("id, name, model, active_version_id")
    .eq("etape", etape)
    .eq("role_code", roleCode)
    .eq("is_active", true)
    .is("frozen_at", null)
    .limit(1)
    .maybeSingle();
  if (!prompt?.active_version_id) return null;
  const { data: version } = await admin
    .from("prompt_versions")
    .select("id, version, content, web_search")
    .eq("id", prompt.active_version_id)
    .maybeSingle();
  if (!version) return null;
  return {
    id: prompt.id,
    name: prompt.name,
    versionId: version.id,
    version: version.version,
    content: version.content,
    model: prompt.model,
    webSearch: version.web_search ?? false,
  };
}

function exigerPrompt(p: PromptResolu | null, quoi: string): PromptResolu {
  if (!p) throw new Error(`Il manque le prompt « ${quoi} » (étape Plan) dans la bibliothèque.`);
  if (promptVide(p.content))
    throw new Error(`Le prompt « ${p.name} » est encore vide : remplissez-le avant de lancer le contrôle.`);
  if (!MODELE_IDS.includes(p.model))
    throw new Error(`Le prompt « ${p.name} » désigne un modèle inconnu de l'atelier : « ${p.model} ».`);
  if (!cleConfiguree(p.model))
    throw new Error(`Il manque la clé d'API ${secretDuModele(p.model)} dans les secrets du projet.`);
  return p;
}

/* ------------------------------------------------------------------ */
/* L'EXÉCUTION                                                         */
/* ------------------------------------------------------------------ */

export type ResultatControle = {
  runId: string;
  mode: ModeControle;
  moyenne: number | null;
  propositions: number;
  planV2Version: number | null;
};

async function inscrireAgentRun(
  editor: EditorContext,
  input: {
    stepId: string;
    robot: string;
    model: string;
    mode: string;
  },
): Promise<string> {
  const admin = await getAdminClient(editor);
  const { data, error } = await admin
    .from("agent_runs")
    .insert({
      kind: "robot",
      robot_name: input.robot,
      status: "en_cours",
      entity: "book_step",
      entity_id: input.stepId,
      book_step_id: input.stepId,
      model: input.model,
      mode: input.mode,
      idempotency_key: `${input.robot}:${input.stepId}:${new Date().toISOString()}`,
      ok: false,
      fields: 0,
      input_chars: 0,
      output_chars: 0,
      created_by: editor.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(texteErreurBase("Le lancement n'a pas pu être enregistré", error));
  return data.id;
}

export async function executerControlePlan(
  editor: EditorContext,
  input: { bookStepId: string; mode?: ModeControle | undefined },
): Promise<ResultatControle> {
  const admin = await getAdminClient(editor);
  const t0 = Date.now();

  const { data: reglages } = await admin
    .from("plan_control_settings")
    .select("enabled, mode")
    .eq("id", true)
    .maybeSingle();
  if (!reglages?.enabled) throw new Error("Le contrôle du plan est arrêté dans les réglages de l'atelier.");
  const mode = (input.mode ?? (reglages.mode as ModeControle)) as ModeControle;

  const { data: step } = await admin
    .from("book_steps")
    .select("id, book_id, step_code, lang")
    .eq("id", input.bookStepId)
    .maybeSingle();
  if (!step) throw new Error("Étape introuvable.");
  if (step.step_code !== CONTROLE_STEP_CODE)
    throw new Error("Le contrôle ne travaille que sur l'étape « Plan de chapitres ».");

  // Un seul contrôle à la fois sur une étape.
  const { data: enCours } = await admin
    .from("plan_control_runs")
    .select("id")
    .eq("book_step_id", step.id)
    .eq("status", "en_cours")
    .limit(1);
  if ((enCours ?? []).length > 0) throw new Error("Un contrôle est déjà en cours sur cette étape.");

  // Le plan de référence : la dernière version déposée.
  const { data: plans } = await admin
    .from("artifacts")
    .select("id, version, storage_path")
    .eq("book_step_id", step.id)
    .eq("type", "plan")
    .order("version", { ascending: false })
    .limit(1);
  const planRef = plans?.[0];
  if (!planRef) throw new Error("Aucun plan n'a encore été déposé sur cette étape.");
  const { text: planV1 } = await downloadArtifactText(editor, planRef.storage_path);
  if (planV1.trim().length === 0) throw new Error("Le plan de référence est vide.");

  const methode = exigerPrompt(await promptDuRole(editor, "plan", "methode_controle"), "Méthode (contrôle)");
  const regles = exigerPrompt(await promptDuRole(editor, "plan", "regles_controle"), "Règles de contrôle");
  const correctif =
    mode === "A" ? null : exigerPrompt(await promptDuRole(editor, "plan", "redaction_corrective"), "Rédaction corrective");

  const { data: controle, error: cErr } = await admin
    .from("plan_control_runs")
    .insert({
      book_id: step.book_id,
      book_step_id: step.id,
      mode,
      status: "en_cours",
      phase: "controle",
      plan_version: planRef.version,
      plan_artifact_id: planRef.id,
      controleur_model: regles.model,
      redacteur_model: correctif?.model ?? null,
      created_by: editor.userId,
    })
    .select("id")
    .single();
  if (cErr || !controle) throw new Error(texteErreurBase("Le contrôle n'a pas pu être enregistré", cErr));

  const echouer = async (message: string): Promise<never> => {
    await admin
      .from("plan_control_runs")
      .update({
        status: "echoue",
        error: message.slice(0, 2000),
        duration_ms: Date.now() - t0,
      })
      .eq("id", controle.id);
    throw new Error(message);
  };

  /* ---------------- 1) LE CONTRÔLEUR ---------------- */
  const runControleur = await inscrireAgentRun(editor, {
    stepId: step.id,
    robot: "controle_plan",
    model: regles.model,
    mode: "controle",
  });

  // Contexte vierge : la méthode de contrôle est jointe, le plan est la matière.
  const systemControleur = `${regles.content}\n\n--- MÉTHODE (document joint) ---\n${methode.content}`;
  const userControleur = `Plan à contrôler :\n\n${planV1}`;

  let rapportBrut = "";
  let rapport: RapportControle;
  let modelControleurUsed = regles.model;
  try {
    const res = await appelerModele({
      model: regles.model,
      webSearch: regles.webSearch,
      system: systemControleur,
      user: userControleur,
      onProgress: async (info) => {
        modelControleurUsed = info.modelUsed;
        await admin.from("agent_runs").update({ model_used: info.modelUsed }).eq("id", runControleur);
      },
    });
    modelControleurUsed = res.modelUsed;
    rapportBrut = res.text;
    if (rapportBrut.trim().length === 0) throw new Error("Le contrôleur a répondu sans contenu.");
    rapport = lireRapport(rapportBrut);
    await admin
      .from("agent_runs")
      .update({
        status: "termine",
        ok: true,
        model_used: res.modelUsed,
        duration_ms: Date.now() - t0,
        input_chars: systemControleur.length + userControleur.length,
        output_chars: res.text.length,
        input_tokens: res.inputTokens,
        output_tokens: res.outputTokens,
        truncated: res.truncated,
        fields: 1,
      })
      .eq("id", runControleur);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("agent_runs")
      .update({
        status: "echoue",
        ok: false,
        model_used: modelControleurUsed,
        error: message.slice(0, 2000),
        error_summary: message.slice(0, 300),
        duration_ms: Date.now() - t0,
        output_chars: rapportBrut.length,
      })
      .eq("id", runControleur);
    await admin
      .from("plan_control_runs")
      .update({ controleur_run_id: runControleur, controleur_model_used: modelControleurUsed })
      .eq("id", controle.id);
    return await echouer(message);
  }

  /* ---------------- 2) LE RAPPORT DÉPOSÉ ---------------- */
  const { data: rapportsPrec } = await admin
    .from("artifacts")
    .select("version")
    .eq("book_step_id", step.id)
    .eq("type", "rapport_controle")
    .order("version", { ascending: false })
    .limit(1);
  const rapportVersion = (rapportsPrec?.[0]?.version ?? 0) + 1;
  const rapportPath = artifactPath({
    bookId: step.book_id,
    stepCode: step.step_code,
    lang: step.lang,
    type: "rapport_controle",
    version: rapportVersion,
    fileName: `rapport-controle-v${rapportVersion}.json`,
  });
  const rapportBytes = new TextEncoder().encode(JSON.stringify(rapport, null, 2)).buffer as ArrayBuffer;
  await uploadArtifactBytes(editor, rapportPath, rapportBytes, "application/json; charset=utf-8");
  const { data: rapportArt } = await admin
    .from("artifacts")
    .insert({
      book_step_id: step.id,
      type: "rapport_controle",
      version: rapportVersion,
      storage_path: rapportPath,
      checksum: await sha256Hex(rapportBytes),
      size_bytes: rapportBytes.byteLength,
      origin: "robot",
      robot_run_id: runControleur,
      prompt_version_id: regles.versionId,
      plan_version: planRef.version,
      created_by: editor.userId,
    })
    .select("id")
    .single();

  await admin
    .from("plan_control_runs")
    .update({
      controleur_run_id: runControleur,
      controleur_model_used: modelControleurUsed,
      report_artifact_id: rapportArt?.id ?? null,
      verdicts: rapport.verdicts,
      notes: rapport.notes,
      propositions: rapport.propositions,
      moyenne: rapport.notes.moyenne,
      phase: mode === "A" ? "termine" : "correction",
    })
    .eq("id", controle.id);

  /* ---------------- 3) LE RÉDACTEUR CORRECTEUR (modes B et C) ---------------- */
  let planV2Version: number | null = null;
  if (correctif) {
    const runRedacteur = await inscrireAgentRun(editor, {
      stepId: step.id,
      robot: "correction_plan",
      model: correctif.model,
      mode: "correction",
    });
    const systemRedacteur = `${correctif.content}\n\n--- MÉTHODE (document joint) ---\n${methode.content}`;
    const userRedacteur = [
      `Plan à corriger (intégral) :\n\n${planV1}`,
      `Rapport de contrôle :\n\n${JSON.stringify(rapport, null, 2)}`,
      "Rends le plan corrigé en entier, au même format que le plan d'origine. Aucun commentaire hors du plan.",
    ].join("\n\n");

    let modelRedacteurUsed = correctif.model;
    try {
      const res = await appelerModele({
        model: correctif.model,
        webSearch: correctif.webSearch,
        system: systemRedacteur,
        user: userRedacteur,
        onProgress: async (info) => {
          modelRedacteurUsed = info.modelUsed;
          await admin.from("agent_runs").update({ model_used: info.modelUsed }).eq("id", runRedacteur);
        },
      });
      modelRedacteurUsed = res.modelUsed;
      if (res.text.trim().length === 0) throw new Error("Le rédacteur correcteur a répondu sans contenu.");
      if (res.truncated) throw new Error("La correction a été coupée : plafond de longueur atteint.");

      planV2Version = planRef.version + 1;
      const planPath = artifactPath({
        bookId: step.book_id,
        stepCode: step.step_code,
        lang: step.lang,
        type: "plan",
        version: planV2Version,
        fileName: `plan-v${planV2Version}.md`,
      });
      const planBytes = new TextEncoder().encode(res.text).buffer as ArrayBuffer;
      await uploadArtifactBytes(editor, planPath, planBytes, "text/markdown; charset=utf-8");
      const { data: planArt, error: pErr } = await admin
        .from("artifacts")
        .insert({
          book_step_id: step.id,
          type: "plan",
          version: planV2Version,
          storage_path: planPath,
          checksum: await sha256Hex(planBytes),
          size_bytes: planBytes.byteLength,
          origin: "robot",
          robot_run_id: runRedacteur,
          prompt_version_id: correctif.versionId,
          plan_version: planV2Version,
          created_by: editor.userId,
        })
        .select("id")
        .single();
      if (pErr) throw new Error(texteErreurBase("Dépôt du plan corrigé refusé", pErr));

      await admin
        .from("agent_runs")
        .update({
          status: "termine",
          ok: true,
          model_used: res.modelUsed,
          duration_ms: Date.now() - t0,
          input_chars: systemRedacteur.length + userRedacteur.length,
          output_chars: res.text.length,
          input_tokens: res.inputTokens,
          output_tokens: res.outputTokens,
          truncated: false,
          fields: 1,
        })
        .eq("id", runRedacteur);

      await admin
        .from("plan_control_runs")
        .update({
          redacteur_run_id: runRedacteur,
          redacteur_model_used: modelRedacteurUsed,
          plan_v2_artifact_id: planArt?.id ?? null,
        })
        .eq("id", controle.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await admin
        .from("agent_runs")
        .update({
          status: "echoue",
          ok: false,
          model_used: modelRedacteurUsed,
          error: message.slice(0, 2000),
          error_summary: message.slice(0, 300),
          duration_ms: Date.now() - t0,
        })
        .eq("id", runRedacteur);
      await admin
        .from("plan_control_runs")
        .update({ redacteur_run_id: runRedacteur, redacteur_model_used: modelRedacteurUsed })
        .eq("id", controle.id);
      return await echouer(message);
    }
  }

  await admin
    .from("plan_control_runs")
    .update({ status: "termine", phase: "termine", duration_ms: Date.now() - t0 })
    .eq("id", controle.id);

  // Le contrôle ne valide rien : l'étape revient m'attendre.
  await admin
    .from("book_steps")
    .update({ status: "attend_validation", awaiting: "ben", updated_at: new Date().toISOString() })
    .eq("id", step.id);

  return {
    runId: controle.id,
    mode,
    moyenne: rapport.notes.moyenne,
    propositions: rapport.propositions.length,
    planV2Version,
  };
}
