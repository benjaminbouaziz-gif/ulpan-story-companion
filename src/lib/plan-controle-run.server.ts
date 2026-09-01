import type { EditorContext } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { artifactPath } from "./artifact-path";
import { downloadArtifactText, sha256Hex, uploadArtifactBytes } from "./atelier-artifacts.server";
import { blocDecisionsPourRobot, synchroniserDecisions } from "./decisions.server";
import { texteErreurBase, violeIndex } from "./db-error";
import { appelerModele, cleConfiguree, fournisseurDuModele, secretDuModele } from "./robot-provider.server";
import { lirePlanChapitres } from "./recit-calibrage";
import {
  lireRapportControleur,
  mesurerMecaniques,
  synthetiser,
  texteVerdict,
  type CritereGrille,
  type VerdictComplet,
} from "./plan-controle";

/**
 * LE FLUX FERMÉ DU PLAN.
 *
 *   Plan v1 → Contrôle v1 → (si écart BLOQUANT) une seule réécriture ciblée
 *            → Plan v2 → Contrôle v2 → attente de la validation humaine.
 *
 * TROIS RÔLES SÉPARÉS, jamais confondus :
 *  1. le GÉNÉRATEUR (ailleurs, inchangé) dépose le plan ;
 *  2. le CONTRÔLEUR lit et juge ; il ne modifie jamais un plan ;
 *  3. le RÉÉCRITEUR corrige les seuls écarts bloquants ; il ne valide jamais.
 *
 * CE QUI EST INTERDIT ICI :
 *  - une troisième tentative : après le contrôle v2, l'éditeur tranche ;
 *  - un plan qui passe sur un rapport inexploitable : le rapport est refusé ;
 *  - un agent qui valide l'étape : seule la main humaine le fait.
 *
 * AUCUNE TABLE NOUVELLE : books, book_steps, artifacts, agent_runs, qc_grids,
 * qc_criteria, qc_reports, qc_verdicts, content_versions et book_decisions
 * suffisent, et servent seuls.
 */

export const PLAN_STEP_CODE = "plan";
export const ROBOT_CONTROLE = "plan_controle";
export const ROBOT_REECRITURE = "plan_reecriture";

export type PhasePlan =
  | "attente_plan"
  | "verification"
  | "corrections"
  | "verification_finale"
  | "validation_requise"
  | "arbitrage_requis";

export type VerdictAffiche = {
  code: string;
  label: string;
  family: string;
  species: string;
  verdict: string;
  isBlocking: boolean;
  location: string | null;
  explanation: string | null;
};

export type RapportAffiche = {
  id: string;
  round: number;
  planVersion: number | null;
  status: string;
  passed: boolean;
  bloquants: number;
  signalements: number;
  criteresTotal: number;
  criteresPasses: number;
  message: string | null;
  modelUsed: string | null;
  createdAt: string;
  verdicts: VerdictAffiche[];
};

export type LigneComparaison = {
  chapterNo: number;
  titreAvant: string | null;
  titreApres: string | null;
  pagesAvant: number | null;
  pagesApres: number | null;
  etat: "identique" | "modifie" | "ajoute" | "retire";
};

export type EtatControlePlan = {
  /** Faux dès que l'étape n'est pas « Plan de chapitres » : l'écran se tait. */
  applicable: boolean;
  phase: PhasePlan;
  /** Un appel est en cours : l'écran suit tout seul. */
  running: boolean;
  /** Le prochain maillon du flux, ou null quand plus rien ne part tout seul. */
  nextAction: "controle" | "reecriture" | null;
  planCourant: { id: string; version: number; createdAt: string } | null;
  versionsPlan: number[];
  rapports: RapportAffiche[];
  comparaison: LigneComparaison[] | null;
  message: string | null;
};

/* ------------------------------------------------------------------ */
/* LECTURE DE L'ÉTAT                                                   */
/* ------------------------------------------------------------------ */

type Contexte = Awaited<ReturnType<typeof lireContexte>>;

async function lireContexte(editor: EditorContext, bookStepId: string) {
  const admin = await getAdminClient(editor);

  const { data: step } = await admin
    .from("book_steps")
    .select("id, book_id, step_code, lang, status")
    .eq("id", bookStepId)
    .maybeSingle();

  const { data: plans } = await admin
    .from("artifacts")
    .select("id, version, storage_path, created_at")
    .eq("book_step_id", bookStepId)
    .eq("type", "plan")
    .order("version", { ascending: true });

  const { data: rapports } = await admin
    .from("qc_reports")
    .select(
      "id, round, plan_version, status, passed, blocking_failed, criteria_total, criteria_passed, message, model_used, created_at, target_artifact_id",
    )
    .eq("book_step_id", bookStepId)
    .order("created_at", { ascending: true });

  const { data: runs } = await admin
    .from("agent_runs")
    .select("id, robot_name, status, mode, created_at")
    .eq("book_step_id", bookStepId)
    .order("created_at", { ascending: true });

  return { admin, step, plans: plans ?? [], rapports: rapports ?? [], runs: runs ?? [] };
}

async function verdictsDuRapport(ctx: Contexte, reportIds: string[]): Promise<Map<string, VerdictAffiche[]>> {
  const parRapport = new Map<string, VerdictAffiche[]>();
  if (reportIds.length === 0) return parRapport;
  const { data } = await ctx.admin
    .from("qc_verdicts")
    .select("report_id, criterion_code, label, family, species, verdict, is_blocking, location, explanation")
    .in("report_id", reportIds)
    .order("created_at", { ascending: true });
  for (const v of data ?? []) {
    const liste = parRapport.get(v.report_id) ?? [];
    liste.push({
      code: v.criterion_code,
      label: v.label,
      family: v.family,
      species: v.species,
      verdict: v.verdict,
      isBlocking: v.is_blocking,
      location: v.location,
      explanation: v.explanation,
    });
    parRapport.set(v.report_id, liste);
  }
  return parRapport;
}

/** La comparaison v1 / v2 : chapitre par chapitre, ce qui a bougé. */
async function comparerPlans(
  editor: EditorContext,
  avant: { storage_path: string },
  apres: { storage_path: string },
): Promise<LigneComparaison[]> {
  const [a, b] = await Promise.all([
    downloadArtifactText(editor, avant.storage_path),
    downloadArtifactText(editor, apres.storage_path),
  ]);
  const ca = new Map(lirePlanChapitres(a.text).chapitres.map((c) => [c.chapterNo, c]));
  const cb = new Map(lirePlanChapitres(b.text).chapitres.map((c) => [c.chapterNo, c]));
  const numeros = [...new Set([...ca.keys(), ...cb.keys()])].sort((x, y) => x - y);
  return numeros.map((n) => {
    const av = ca.get(n) ?? null;
    const ap = cb.get(n) ?? null;
    const etat: LigneComparaison["etat"] = !av
      ? "ajoute"
      : !ap
        ? "retire"
        : av.titre === ap.titre && av.pages === ap.pages
          ? "identique"
          : "modifie";
    return {
      chapterNo: n,
      titreAvant: av?.titre ?? null,
      titreApres: ap?.titre ?? null,
      pagesAvant: av?.pages ?? null,
      pagesApres: ap?.pages ?? null,
      etat,
    };
  });
}

export async function etatControlePlan(
  editor: EditorContext,
  bookStepId: string,
): Promise<EtatControlePlan> {
  const ctx = await lireContexte(editor, bookStepId);
  const vide: EtatControlePlan = {
    applicable: false,
    phase: "attente_plan",
    running: false,
    nextAction: null,
    planCourant: null,
    versionsPlan: [],
    rapports: [],
    comparaison: null,
    message: null,
  };
  if (!ctx.step || ctx.step.step_code !== PLAN_STEP_CODE) return vide;

  const parRapport = await verdictsDuRapport(
    ctx,
    ctx.rapports.map((r) => r.id),
  );
  const rapports: RapportAffiche[] = ctx.rapports.map((r) => ({
    id: r.id,
    round: r.round,
    planVersion: r.plan_version,
    status: r.status,
    passed: r.passed,
    bloquants: r.blocking_failed,
    signalements: Math.max(0, r.criteria_total - r.criteria_passed - r.blocking_failed),
    criteresTotal: r.criteria_total,
    criteresPasses: r.criteria_passed,
    message: r.message,
    modelUsed: r.model_used,
    createdAt: r.created_at,
    verdicts: parRapport.get(r.id) ?? [],
  }));

  const dernierPlan = ctx.plans[ctx.plans.length - 1] ?? null;
  const enCours = ctx.runs.find((r) => r.status === "en_cours") ?? null;
  const reecritureFaite = ctx.runs.some(
    (r) => r.robot_name === ROBOT_REECRITURE && r.status === "termine",
  );
  const figee = ctx.step.status === "valide" || ctx.step.status === "valide_hors_crm";

  let comparaison: LigneComparaison[] | null = null;
  if (ctx.plans.length >= 2) {
    const avant = ctx.plans[ctx.plans.length - 2]!;
    const apres = ctx.plans[ctx.plans.length - 1]!;
    try {
      comparaison = await comparerPlans(editor, avant, apres);
    } catch {
      comparaison = null;
    }
  }

  const base = {
    applicable: true,
    running: enCours !== null,
    planCourant: dernierPlan
      ? { id: dernierPlan.id, version: dernierPlan.version, createdAt: dernierPlan.created_at }
      : null,
    versionsPlan: ctx.plans.map((p) => p.version),
    rapports,
    comparaison,
  };

  if (!dernierPlan)
    return {
      ...vide,
      ...base,
      phase: "attente_plan",
      nextAction: null,
      message: "Aucun plan n'a encore été déposé sur cette étape.",
    };

  if (enCours)
    return {
      ...vide,
      ...base,
      phase:
        enCours.robot_name === ROBOT_REECRITURE
          ? "corrections"
          : enCours.robot_name === ROBOT_CONTROLE
            ? dernierPlan.version > 1
              ? "verification_finale"
              : "verification"
            : "attente_plan",
      nextAction: null,
      message: null,
    };

  const rapportDuPlan =
    [...rapports].reverse().find((r) => r.planVersion === dernierPlan.version) ?? null;

  if (!rapportDuPlan)
    return {
      ...vide,
      ...base,
      phase: dernierPlan.version > 1 ? "verification_finale" : "verification",
      nextAction: figee ? null : "controle",
      message: null,
    };

  if (rapportDuPlan.status === "erreur")
    return {
      ...vide,
      ...base,
      phase: "arbitrage_requis",
      nextAction: null,
      message: rapportDuPlan.message,
    };

  if (rapportDuPlan.passed)
    return {
      ...vide,
      ...base,
      phase: "validation_requise",
      nextAction: null,
      message:
        rapportDuPlan.signalements > 0
          ? `Aucun écart bloquant. ${rapportDuPlan.signalements} signalement(s) à lire avant de valider.`
          : "Aucun écart bloquant.",
    };

  if (!reecritureFaite)
    return {
      ...vide,
      ...base,
      phase: "corrections",
      nextAction: figee ? null : "reecriture",
      message: `${rapportDuPlan.bloquants} écart(s) bloquant(s) : une réécriture ciblée, une seule.`,
    };

  return {
    ...vide,
    ...base,
    phase: "arbitrage_requis",
    nextAction: null,
    message: `${rapportDuPlan.bloquants} écart(s) bloquant(s) subsistent après la réécriture : à vous de trancher.`,
  };
}

/* ------------------------------------------------------------------ */
/* LA MATIÈRE ENVOYÉE AUX DEUX RÔLES                                   */
/* ------------------------------------------------------------------ */

async function blocFiche(ctx: Contexte, bookId: string): Promise<{ texte: string; chapitresAttendus: number | null }> {
  const { data: book } = await ctx.admin
    .from("books")
    .select(
      "id, title_fr, collection_id, chapters_count, work_summary_fr, book_constraints_fr, intent_note_fr, source_material_fr",
    )
    .eq("id", bookId)
    .maybeSingle();
  if (!book) throw new Error("Livre introuvable.");

  const collection = book.collection_id
    ? (
        await ctx.admin
          .from("collections")
          .select("name_fr, story_nature_fr, description_fr")
          .eq("id", book.collection_id)
          .maybeSingle()
      ).data
    : null;

  const texte = [
    "FICHE DU LIVRE :",
    `Titre de travail : ${book.title_fr}`,
    `Collection : ${collection?.name_fr ?? "non renseignée"}`,
    collection?.story_nature_fr ? `Nature de la collection :\n${collection.story_nature_fr}` : null,
    book.chapters_count ? `Nombre de chapitres attendu : ${book.chapters_count}` : null,
    (book.work_summary_fr ?? "").trim().length > 0 ? `Résumé de l'éditeur :\n${book.work_summary_fr}` : null,
    (book.book_constraints_fr ?? "").trim().length > 0
      ? `Consignes propres au livre :\n${book.book_constraints_fr}`
      : null,
    (book.intent_note_fr ?? "").trim().length > 0 ? `Ton et angle :\n${book.intent_note_fr}` : null,
    (book.source_material_fr ?? "").trim().length > 0
      ? `Matière documentaire :\n${book.source_material_fr}`
      : null,
  ]
    .filter((s): s is string => s !== null)
    .join("\n\n");

  return { texte, chapitresAttendus: book.chapters_count };
}

async function promptActif(
  ctx: Contexte,
  roleCode: string,
): Promise<{ promptId: string; versionId: string; version: number; content: string; model: string; webSearch: boolean }> {
  const { data: prompts } = await ctx.admin
    .from("prompts")
    .select("id, code, name, active_version_id")
    .eq("etape", "plan")
    .eq("role_code", roleCode)
    .eq("is_active", true);
  const candidats = (prompts ?? []).filter((p) => p.active_version_id !== null);
  if (candidats.length === 0)
    throw new Error(`Aucun prompt actif pour le rôle « ${roleCode} » de l'étape Plan.`);

  const { data: versions } = await ctx.admin
    .from("prompt_versions")
    .select("id, prompt_id, version, content, model, web_search")
    .in(
      "id",
      candidats.map((p) => p.active_version_id!),
    );
  // Deux prompts peuvent porter le même rôle : on retient le plus étoffé,
  // jamais un tirage au hasard.
  const choisie = (versions ?? []).sort((a, b) => b.content.length - a.content.length)[0];
  if (!choisie) throw new Error(`La version active du rôle « ${roleCode} » est introuvable.`);
  const model = (choisie.model ?? "").trim();
  if (model.length === 0)
    throw new Error(`La version active du rôle « ${roleCode} » ne précise aucun modèle.`);
  if (!fournisseurDuModele(model)) throw new Error(`Modèle inconnu de l'atelier : « ${model} ».`);
  if (!cleConfiguree(model))
    throw new Error(`Il manque la clé d'API ${secretDuModele(model)} dans les secrets du projet.`);

  return {
    promptId: choisie.prompt_id,
    versionId: choisie.id,
    version: choisie.version,
    content: choisie.content,
    model,
    webSearch: choisie.web_search ?? false,
  };
}

async function grilleDuPlan(ctx: Contexte): Promise<{ gridId: string; criteres: CritereGrille[] }> {
  const { data: grid } = await ctx.admin
    .from("qc_grids")
    .select("id")
    .eq("step_code", PLAN_STEP_CODE)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!grid) throw new Error("Aucune grille de contrôle active pour l'étape Plan.");

  const { data: rows } = await ctx.admin
    .from("qc_criteria")
    .select("id, code, label, question, family, is_blocking, species, mechanic_key")
    .eq("grid_id", grid.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  const criteres: CritereGrille[] = (rows ?? []).map((c) => ({
    code: c.code,
    label: c.label,
    question: c.question,
    family: c.family,
    isBlocking: c.is_blocking,
    species: c.species === "mecanique" ? "mecanique" : "juge",
    mechanicKey: c.mechanic_key,
  }));
  if (criteres.length === 0) throw new Error("La grille de contrôle du plan est vide.");
  return { gridId: grid.id, criteres };
}

async function idsDesCriteres(ctx: Contexte, gridId: string): Promise<Map<string, string>> {
  const { data } = await ctx.admin.from("qc_criteria").select("id, code").eq("grid_id", gridId);
  return new Map((data ?? []).map((c) => [c.code, c.id]));
}

/* ------------------------------------------------------------------ */
/* LES MAILLONS : UN APPEL PAR REQUÊTE                                 */
/* ------------------------------------------------------------------ */

async function ouvrirRun(
  ctx: Contexte,
  editor: EditorContext,
  args: { stepId: string; robot: string; model: string; mode: string; cle: string },
): Promise<string> {
  const { data: run, error } = await ctx.admin
    .from("agent_runs")
    .insert({
      kind: "robot",
      robot_name: args.robot,
      status: "en_cours",
      entity: "book_step",
      entity_id: args.stepId,
      book_step_id: args.stepId,
      model: args.model,
      mode: args.mode,
      idempotency_key: args.cle,
      ok: false,
      fields: 0,
      input_chars: 0,
      output_chars: 0,
      created_by: editor.userId,
    })
    .select("id")
    .single();
  if (error || !run) {
    if (violeIndex(error, "agent_runs_un_seul_en_cours_par_etape"))
      throw new Error("Un lancement est déjà en cours sur cette étape.");
    throw new Error(texteErreurBase("Le lancement n'a pas pu être enregistré", error));
  }
  return run.id;
}

async function clore(
  ctx: Contexte,
  runId: string,
  args: {
    ok: boolean;
    modelUsed: string | null;
    inputChars: number;
    outputChars: number;
    outputTokens?: number | null;
    inputTokens?: number | null;
    costUsd?: number | null;
    startedAt: number;
    error?: string;
  },
): Promise<void> {
  await ctx.admin
    .from("agent_runs")
    .update({
      status: args.ok ? "termine" : "echoue",
      ok: args.ok,
      model_used: args.modelUsed,
      cost_usd: args.costUsd ?? null,
      duration_ms: Date.now() - args.startedAt,
      input_chars: args.inputChars,
      output_chars: args.outputChars,
      output_tokens: args.outputTokens ?? null,
      input_tokens: args.inputTokens ?? null,
      fields: args.ok ? 1 : 0,
      ...(args.error ? { error: args.error.slice(0, 2000), error_summary: args.error.slice(0, 300) } : {}),
    })
    .eq("id", runId);
}

async function marquerEtape(ctx: Contexte, stepId: string, status: string, awaiting: string): Promise<void> {
  await ctx.admin
    .from("book_steps")
    .update({ status, awaiting, updated_at: new Date().toISOString() })
    .eq("id", stepId);
}

/** LE CONTRÔLE. Il ne modifie aucun plan : il dépose un rapport, et rien d'autre. */
async function executerControle(editor: EditorContext, bookStepId: string): Promise<string> {
  const ctx = await lireContexte(editor, bookStepId);
  if (!ctx.step) throw new Error("Étape introuvable.");
  if (ctx.step.step_code !== PLAN_STEP_CODE)
    throw new Error("Le contrôle du plan ne travaille que sur l'étape « Plan de chapitres ».");
  const plan = ctx.plans[ctx.plans.length - 1];
  if (!plan) throw new Error("Aucun plan à contrôler sur cette étape.");

  const { gridId, criteres } = await grilleDuPlan(ctx);
  const prompt = await promptActif(ctx, "methode_controle");
  const regles = await promptActif(ctx, "regles_controle").catch(() => null);
  const fiche = await blocFiche(ctx, ctx.step.book_id);
  const decisions = await blocDecisionsPourRobot(editor, ctx.step.book_id);
  const planTexte = (await downloadArtifactText(editor, plan.storage_path)).text;
  if (planTexte.trim().length === 0) throw new Error("Le plan à contrôler est vide.");

  const round = ctx.rapports.length + 1;
  const startedAt = Date.now();
  const runId = await ouvrirRun(ctx, editor, {
    stepId: ctx.step.id,
    robot: ROBOT_CONTROLE,
    model: prompt.model,
    mode: "controle",
    cle: `controle:${ctx.step.id}:v${plan.version}:${new Date(startedAt).toISOString()}`,
  });
  await marquerEtape(ctx, ctx.step.id, "en_cours", "robot");

  // Ce que le code mesure lui-même n'est jamais demandé au modèle.
  const mecaniques = mesurerMecaniques(planTexte, criteres, fiche.chapitresAttendus);
  const juges = criteres.filter((c) => c.species === "juge");

  const matiere = [
    regles ? `RÈGLES DE CONTRÔLE DE LA MAISON :\n${regles.content}` : null,
    [
      "CRITÈRES À JUGER — un verdict par code, ni plus, ni moins :",
      ...juges.map((c) => `- ${c.code} · ${c.label} : ${c.question}`),
    ].join("\n"),
    fiche.texte,
    decisions,
    `PLAN À CONTRÔLER (version ${plan.version}) :\n${planTexte}`,
  ]
    .filter((s): s is string => s !== null)
    .join("\n\n");

  let result: Awaited<ReturnType<typeof appelerModele>> | undefined;
  let erreurAppel: string | null = null;
  try {
    result = await appelerModele({
      model: prompt.model,
      webSearch: false,
      system: prompt.content,
      user: matiere,
      onProgress: async (info) => {
        await ctx.admin
          .from("agent_runs")
          .update({ model_used: info.modelUsed })
          .eq("id", runId)
          .eq("status", "en_cours");
      },
    });
    if (result.text.trim().length === 0) throw new Error("Le contrôleur a répondu sans contenu.");
    if (result.truncated) throw new Error("La réponse du contrôleur a été coupée : plafond de longueur atteint.");
  } catch (e) {
    erreurAppel = e instanceof Error ? e.message : String(e);
  }

  const lecture = erreurAppel
    ? { ok: false, verdicts: [] as VerdictComplet[], erreurs: [erreurAppel] }
    : lireRapportControleur(result!.text, criteres);

  const inputChars = prompt.content.length + matiere.length;
  const outputChars = result?.text.length ?? 0;

  // RAPPORT INEXPLOITABLE : le plan reste en place, l'échec est écrit, rien
  // n'est validé et aucune réécriture n'est déclenchée.
  if (!lecture.ok) {
    const message = lecture.erreurs.join(" ");
    await clore(ctx, runId, {
      ok: false,
      modelUsed: result?.modelUsed ?? prompt.model,
      inputChars,
      outputChars,
      outputTokens: result?.outputTokens ?? null,
      inputTokens: result?.inputTokens ?? null,
      startedAt,
      error: message,
    });
    await ctx.admin.from("qc_reports").insert({
      book_step_id: ctx.step.id,
      grid_id: gridId,
      round,
      plan_version: plan.version,
      target_artifact_id: plan.id,
      agent_run_id: runId,
      status: "erreur",
      passed: false,
      blocking_failed: 0,
      criteria_total: criteres.length,
      criteria_passed: 0,
      message: message.slice(0, 2000),
      model_used: result?.modelUsed ?? prompt.model,
      duration_ms: Date.now() - startedAt,
      created_by: editor.userId,
      regles_prompt_version_id: regles?.versionId ?? null,
      regles_version: regles?.version ?? null,
    });
    await marquerEtape(ctx, ctx.step.id, "attend_validation", "ben");
    throw new Error(`Contrôle inexploitable : ${message}`);
  }

  const verdicts: VerdictComplet[] = [...mecaniques, ...lecture.verdicts];
  const bilan = synthetiser(verdicts);
  const statut = bilan.passe ? "valide" : round >= 2 ? "arrete_plafond" : "a_revoir";

  // Le rapport devient un artefact : jamais écrasé, il dit quel plan il juge.
  const rapportJson = JSON.stringify(
    {
      etape: "plan",
      round,
      plan_version: plan.version,
      plan_artifact_id: plan.id,
      grille: gridId,
      modele: result?.modelUsed ?? prompt.model,
      prompt_version: prompt.version,
      regles_version: regles?.version ?? null,
      synthese: bilan,
      verdicts,
    },
    null,
    2,
  );
  const { data: dernierRapport } = await ctx.admin
    .from("artifacts")
    .select("version")
    .eq("book_step_id", ctx.step.id)
    .eq("type", "rapport_controle")
    .order("version", { ascending: false })
    .limit(1);
  const versionRapport = (dernierRapport?.[0]?.version ?? 0) + 1;
  const storagePath = artifactPath({
    bookId: ctx.step.book_id,
    stepCode: ctx.step.step_code,
    lang: ctx.step.lang,
    type: "rapport_controle",
    version: versionRapport,
    fileName: `rapport-controle-plan-v${plan.version}-r${round}.json`,
  });
  const bytes = new TextEncoder().encode(rapportJson).buffer as ArrayBuffer;
  await uploadArtifactBytes(editor, storagePath, bytes, "application/json; charset=utf-8");
  const { error: artErr } = await ctx.admin.from("artifacts").insert({
    book_step_id: ctx.step.id,
    type: "rapport_controle",
    version: versionRapport,
    storage_path: storagePath,
    checksum: await sha256Hex(bytes),
    size_bytes: bytes.byteLength,
    origin: "robot",
    robot_run_id: runId,
    prompt_version_id: prompt.versionId,
    plan_version: plan.version,
    created_by: editor.userId,
  });
  if (artErr) throw new Error(texteErreurBase("Dépôt du rapport refusé", artErr));

  const { data: rapport, error: repErr } = await ctx.admin
    .from("qc_reports")
    .insert({
      book_step_id: ctx.step.id,
      grid_id: gridId,
      round,
      plan_version: plan.version,
      target_artifact_id: plan.id,
      agent_run_id: runId,
      status: statut,
      passed: bilan.passe,
      blocking_failed: bilan.bloquants,
      criteria_total: bilan.total,
      criteria_passed: bilan.valides,
      message: bilan.passe
        ? `Aucun écart bloquant sur ${bilan.total} critères.`
        : `${bilan.bloquants} écart(s) bloquant(s) et ${bilan.signalements} signalement(s).`,
      model_used: result?.modelUsed ?? prompt.model,
      duration_ms: Date.now() - startedAt,
      created_by: editor.userId,
      regles_prompt_version_id: regles?.versionId ?? null,
      regles_version: regles?.version ?? null,
    })
    .select("id")
    .single();
  if (repErr || !rapport) throw new Error(texteErreurBase("Le rapport n'a pas pu être enregistré", repErr));

  const ids = await idsDesCriteres(ctx, gridId);
  await ctx.admin.from("qc_verdicts").insert(
    verdicts.map((v) => ({
      report_id: rapport.id,
      criterion_id: ids.get(v.code) ?? null,
      criterion_code: v.code,
      label: v.label,
      family: v.family,
      is_blocking: v.severity === "bloquant",
      species: v.species,
      verdict: v.verdict,
      location: v.location || null,
      explanation: texteVerdict(v) || null,
    })),
  );

  await clore(ctx, runId, {
    ok: true,
    modelUsed: result?.modelUsed ?? prompt.model,
    inputChars,
    outputChars,
    outputTokens: result?.outputTokens ?? null,
    inputTokens: result?.inputTokens ?? null,
    costUsd: result?.costUsd ?? null,
    startedAt,
  });

  // Aucun agent ne valide : au mieux, l'étape revient à l'éditeur.
  if (bilan.passe || round >= 2) await marquerEtape(ctx, ctx.step.id, "attend_validation", "ben");
  else await marquerEtape(ctx, ctx.step.id, "en_cours", "robot");

  return bilan.passe
    ? `Contrôle ${round} : aucun écart bloquant.`
    : `Contrôle ${round} : ${bilan.bloquants} écart(s) bloquant(s).`;
}

/** LA RÉÉCRITURE CIBLÉE, UNE SEULE FOIS. Elle ne valide jamais l'étape. */
async function executerReecriture(editor: EditorContext, bookStepId: string): Promise<string> {
  const ctx = await lireContexte(editor, bookStepId);
  if (!ctx.step) throw new Error("Étape introuvable.");
  const plan = ctx.plans[ctx.plans.length - 1];
  if (!plan) throw new Error("Aucun plan source à corriger.");

  if (ctx.runs.some((r) => r.robot_name === ROBOT_REECRITURE && r.status === "termine"))
    throw new Error("La réécriture ciblée a déjà eu lieu : il n'y en a qu'une.");

  const rapport = [...ctx.rapports].reverse().find((r) => r.plan_version === plan.version) ?? null;
  if (!rapport) throw new Error("Ce plan n'a pas encore été contrôlé.");
  if (rapport.status === "erreur") throw new Error("Le dernier contrôle est inexploitable : rien à corriger.");
  if (rapport.passed) throw new Error("Le dernier contrôle ne relève aucun écart bloquant.");

  const { data: verdicts } = await ctx.admin
    .from("qc_verdicts")
    .select("criterion_code, label, is_blocking, verdict, location, explanation")
    .eq("report_id", rapport.id);
  const bloquants = (verdicts ?? []).filter((v) => v.verdict === "echoue" && v.is_blocking);
  if (bloquants.length === 0) throw new Error("Aucun écart bloquant à corriger dans ce rapport.");

  const prompt = await promptActif(ctx, "redaction_corrective");
  const fiche = await blocFiche(ctx, ctx.step.book_id);
  const decisions = await blocDecisionsPourRobot(editor, ctx.step.book_id);
  const planTexte = (await downloadArtifactText(editor, plan.storage_path)).text;

  const matiere = [
    fiche.texte,
    decisions,
    [
      "ÉCARTS BLOQUANTS À CORRIGER — et rien d'autre :",
      ...bloquants.map(
        (v, i) =>
          `${i + 1}. [${v.criterion_code}] ${v.label}${v.location ? ` — ${v.location}` : ""}\n${v.explanation ?? ""}`,
      ),
    ].join("\n"),
    `PLAN SOURCE (version ${plan.version}) :\n${planTexte}`,
  ]
    .filter((s): s is string => s !== null)
    .join("\n\n");

  const startedAt = Date.now();
  const runId = await ouvrirRun(ctx, editor, {
    stepId: ctx.step.id,
    robot: ROBOT_REECRITURE,
    model: prompt.model,
    mode: "correction",
    cle: `reecriture:${ctx.step.id}:v${plan.version}:${new Date(startedAt).toISOString()}`,
  });
  await marquerEtape(ctx, ctx.step.id, "en_cours", "robot");

  let result: Awaited<ReturnType<typeof appelerModele>> | undefined;
  try {
    result = await appelerModele({
      model: prompt.model,
      webSearch: false,
      system: prompt.content,
      user: matiere,
      onProgress: async (info) => {
        await ctx.admin
          .from("agent_runs")
          .update({ model_used: info.modelUsed })
          .eq("id", runId)
          .eq("status", "en_cours");
      },
    });
    if (result.text.trim().length === 0) throw new Error("Le réécriteur a répondu sans contenu.");
    if (result.truncated) throw new Error("La réécriture a été coupée : plafond de longueur atteint.");
    // Une réécriture illisible n'est PAS un plan : le plan source reste en place.
    const relu = lirePlanChapitres(result.text);
    if (relu.chapitres.length === 0)
      throw new Error("La réécriture ne contient aucun chapitre au format attendu : elle est refusée.");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await clore(ctx, runId, {
      ok: false,
      modelUsed: result?.modelUsed ?? prompt.model,
      inputChars: prompt.content.length + matiere.length,
      outputChars: result?.text.length ?? 0,
      startedAt,
      error: message,
    });
    await marquerEtape(ctx, ctx.step.id, "attend_validation", "ben");
    throw new Error(message);
  }

  const versionPlan = plan.version + 1;
  const storagePath = artifactPath({
    bookId: ctx.step.book_id,
    stepCode: ctx.step.step_code,
    lang: ctx.step.lang,
    type: "plan",
    version: versionPlan,
    fileName: `plan-v${versionPlan}.md`,
  });
  const bytes = new TextEncoder().encode(result.text).buffer as ArrayBuffer;
  await uploadArtifactBytes(editor, storagePath, bytes, "text/markdown; charset=utf-8");
  const { data: nouveau, error: artErr } = await ctx.admin
    .from("artifacts")
    .insert({
      book_step_id: ctx.step.id,
      type: "plan",
      version: versionPlan,
      storage_path: storagePath,
      checksum: await sha256Hex(bytes),
      size_bytes: bytes.byteLength,
      origin: "robot",
      robot_run_id: runId,
      prompt_version_id: prompt.versionId,
      plan_version: plan.version,
      created_by: editor.userId,
    })
    .select("id")
    .single();
  if (artErr || !nouveau) throw new Error(texteErreurBase("Dépôt du plan corrigé refusé", artErr));

  // TRAÇABILITÉ : le plan réécrit dit d'où il vient, sans nouvelle table.
  await ctx.admin.from("content_versions").insert({
    entity: "plan_reecriture",
    entity_id: nouveau.id,
    snapshot: {
      plan_source_artifact_id: plan.id,
      plan_source_version: plan.version,
      rapport_source_id: rapport.id,
      rapport_round: rapport.round,
      agent_run_id: runId,
      prompt_version_id: prompt.versionId,
      ecarts_bloquants: bloquants.map((v) => v.criterion_code),
    },
    created_by: editor.userId,
  });

  await synchroniserDecisions(editor, {
    bookId: ctx.step.book_id,
    bookStepId: ctx.step.id,
    markdown: result.text,
  });

  await clore(ctx, runId, {
    ok: true,
    modelUsed: result.modelUsed,
    inputChars: prompt.content.length + matiere.length,
    outputChars: result.text.length,
    outputTokens: result.outputTokens,
    inputTokens: result.inputTokens,
    costUsd: result.costUsd,
    startedAt,
  });
  await marquerEtape(ctx, ctx.step.id, "en_cours", "robot");

  return `Plan v${versionPlan} déposé : ${bloquants.length} écart(s) bloquant(s) visés.`;
}

/**
 * UN CLIC, UN MAILLON. L'écran rappelle cette fonction tant qu'il reste un
 * maillon : le flux ne tient jamais dans une seule requête, et personne
 * n'attend cinq minutes devant un bouton muet.
 */
export async function avancerControlePlan(
  editor: EditorContext,
  bookStepId: string,
): Promise<{ message: string; etat: EtatControlePlan }> {
  const avant = await etatControlePlan(editor, bookStepId);
  if (!avant.applicable) return { message: "Cette étape n'est pas le plan de chapitres.", etat: avant };
  if (avant.running) return { message: "Un appel est déjà en cours.", etat: avant };
  if (!avant.nextAction) return { message: avant.message ?? "Rien à lancer.", etat: avant };

  const message =
    avant.nextAction === "controle"
      ? await executerControle(editor, bookStepId)
      : await executerReecriture(editor, bookStepId);

  return { message, etat: await etatControlePlan(editor, bookStepId) };
}
