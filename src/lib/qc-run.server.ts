import type { EditorContext } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { downloadArtifactText } from "./atelier-artifacts.server";
import { blocDecisionsPourRobot } from "./decisions.server";
import { lirePlanChapitres, type ChapitrePlan } from "./recit-calibrage";
import { texteErreurBase } from "./db-error";
import { assemblerLeRecit, executerChapitre, REDACTION_STEP_CODE } from "./atelier-recit-run.server";
import { executerLancementPlan, PLAN_STEP_CODE } from "./atelier-robot-run.server";
import {
  appelerControleur,
  calculerNotes,
  controleActif,
  lireGrille,
  lirePolitique,
  lirePromptControleur,
  verdictsMecaniques,
  type Critere,
  type Grille,
  type Notes,
  type Politique,
  type VerdictCalcule,
} from "./qc-core.server";

/**
 * BRIQUE 9 — LA CONDUITE DU CONTRÔLE.
 *
 * Le contrôle n'est PAS une étape de la chaîne : c'est une propriété de
 * l'étape qu'il contrôle. Rien n'est ajouté aux rangs ni au modèle de chaîne.
 *
 * TROIS SORTIES, JAMAIS DE QUATRIÈME :
 *   1. validé — zéro bloquant échoué et seuil atteint ;
 *   2. plafond de tours atteint ;
 *   3. note générale stagnante (moins d'un point gagné d'un tour au suivant).
 * Dans les cas 2 et 3, l'étape reste à revoir manuellement, dernier rapport
 * joint. La chaîne ne valide jamais d'office un livrable non validé.
 */

type Admin = Awaited<ReturnType<typeof getAdminClient>>;

export type ResumeControle = {
  reportId: string | null;
  rounds: number;
  status: "valide" | "a_revoir" | "arrete_plafond" | "arrete_stagnation" | "erreur" | "desactive";
  message: string;
  scoreGeneral: number | null;
  blockingFailed: number;
};

const MOT_TRANSVERSAL = /(refrain|boucl|notion|lexique|récurren|recurren|motif)/i;

/* ------------------------------------------------------------------ */
/* LECTURES                                                            */
/* ------------------------------------------------------------------ */

async function lireEtape(admin: Admin, bookStepId: string) {
  const { data } = await admin
    .from("book_steps")
    .select("id, book_id, step_code, lang, status, label_fr")
    .eq("id", bookStepId)
    .maybeSingle();
  return data;
}

async function ficheDuLivre(admin: Admin, bookId: string): Promise<string> {
  const { data: book } = await admin
    .from("books")
    .select("title_fr, work_summary_fr, book_constraints_fr, intent_note_fr, collection_id")
    .eq("id", bookId)
    .maybeSingle();
  if (!book) return "";
  const collection = book.collection_id
    ? ((await admin.from("collections").select("name_fr, story_nature_fr, for_whom_fr").eq("id", book.collection_id).maybeSingle())
        .data ?? null)
    : null;
  return [
    "FICHE DU LIVRE :",
    `Titre de travail : ${book.title_fr}`,
    collection?.name_fr ? `Collection : ${collection.name_fr}` : null,
    collection?.story_nature_fr ? `Nature des récits de la collection : ${collection.story_nature_fr}` : null,
    collection?.for_whom_fr ? `Pour qui : ${collection.for_whom_fr}` : null,
    (book.work_summary_fr ?? "").trim() ? `Résumé de l'éditeur :\n${book.work_summary_fr}` : null,
    (book.book_constraints_fr ?? "").trim() ? `Consignes propres au livre :\n${book.book_constraints_fr}` : null,
    (book.intent_note_fr ?? "").trim() ? `Ton et angle :\n${book.intent_note_fr}` : null,
  ]
    .filter((s): s is string => s !== null)
    .join("\n");
}

/** L'étape « Plan de chapitres » du même livre, même langue si elle existe. */
async function etapePlan(admin: Admin, bookId: string, lang: string) {
  const { data } = await admin
    .from("book_steps")
    .select("id, status, lang")
    .eq("book_id", bookId)
    .eq("step_code", PLAN_STEP_CODE);
  return (data ?? []).find((p) => p.lang === lang) ?? (data ?? []).find((p) => p.lang === "shared") ?? (data ?? [])[0] ?? null;
}

/**
 * LE PLAN QUI A SERVI À ÉCRIRE. On prend la VERSION inscrite sur l'artefact du
 * chapitre, jamais la version courante : un plan révisé après coup ne doit pas
 * faire échouer un texte écrit sous l'ancien.
 */
async function planDeLaVersion(
  editor: EditorContext,
  admin: Admin,
  args: { bookId: string; lang: string; version: number | null },
): Promise<{ text: string; version: number | null }> {
  const step = await etapePlan(admin, args.bookId, args.lang);
  if (!step) return { text: "", version: null };
  let requete = admin
    .from("artifacts")
    .select("storage_path, version")
    .eq("book_step_id", step.id)
    .eq("type", "plan");
  if (args.version !== null) requete = requete.eq("version", args.version);
  const { data } = await requete.order("version", { ascending: false }).limit(1);
  const trouve = data?.[0];
  if (!trouve) return { text: "", version: null };
  try {
    const { text } = await downloadArtifactText(editor, trouve.storage_path);
    return { text, version: trouve.version };
  } catch {
    return { text: "", version: trouve.version };
  }
}

type ChapitreArtefact = {
  chapterNo: number;
  artifactId: string;
  version: number;
  storagePath: string;
  planVersion: number | null;
};

async function chapitresDeposes(admin: Admin, stepId: string): Promise<ChapitreArtefact[]> {
  const { data } = await admin
    .from("artifacts")
    .select("id, chapter_no, version, storage_path, plan_version")
    .eq("book_step_id", stepId)
    .eq("type", "chapitre")
    .order("chapter_no", { ascending: true })
    .order("version", { ascending: false });
  const derniers = new Map<number, ChapitreArtefact>();
  for (const a of data ?? []) {
    if (a.chapter_no === null || derniers.has(a.chapter_no)) continue;
    derniers.set(a.chapter_no, {
      chapterNo: a.chapter_no,
      artifactId: a.id,
      version: a.version,
      storagePath: a.storage_path,
      planVersion: a.plan_version ?? null,
    });
  }
  return [...derniers.values()].sort((a, b) => a.chapterNo - b.chapterNo);
}

/* ------------------------------------------------------------------ */
/* UN TOUR DE CONTRÔLE                                                 */
/* ------------------------------------------------------------------ */

type Tour = {
  reportId: string;
  verdicts: VerdictCalcule[];
  notes: Notes;
  chapterNo: number | null;
};

async function enregistrerRapport(
  admin: Admin,
  editor: EditorContext,
  args: {
    bookStepId: string;
    gridId: string;
    round: number;
    chapterNo: number | null;
    targetArtifactId: string | null;
    planVersion: number | null;
    agentRunId: string | null;
    status: string;
    stopReason: string | null;
    message: string | null;
    modelUsed: string | null;
    durationMs: number | null;
    verdicts: VerdictCalcule[];
    notes: Notes;
  },
): Promise<string> {
  const { data: report, error } = await admin
    .from("qc_reports")
    .insert({
      book_step_id: args.bookStepId,
      grid_id: args.gridId,
      round: args.round,
      chapter_no: args.chapterNo,
      target_artifact_id: args.targetArtifactId,
      plan_version: args.planVersion,
      agent_run_id: args.agentRunId,
      status: args.status,
      passed: args.notes.ok,
      blocking_failed: args.notes.blockingFailed,
      criteria_total: args.notes.total,
      criteria_passed: args.notes.passed,
      score_general: args.notes.general,
      score_conformite: args.notes.parFamille.conformite,
      score_structure: args.notes.parFamille.structure,
      score_pedagogie: args.notes.parFamille.pedagogie,
      score_langue: args.notes.parFamille.langue,
      stop_reason: args.stopReason,
      message: args.message,
      model_used: args.modelUsed,
      duration_ms: args.durationMs,
      created_by: editor.userId,
    })
    .select("id")
    .single();
  if (error || !report) throw new Error("Le rapport de contrôle n'a pas pu être enregistré.");

  if (args.verdicts.length > 0) {
    const { error: errV } = await admin.from("qc_verdicts").insert(
      args.verdicts.map((v) => ({
        report_id: report.id,
        criterion_id: v.criterionId,
        criterion_code: v.code,
        label: v.label,
        family: v.family,
        is_blocking: v.isBlocking,
        species: v.species,
        verdict: v.verdict,
        location: v.location,
        explanation: v.explanation,
      })),
    );
    // Un rapport sans ses verdicts est un rapport qui ment : on échoue.
    if (errV) throw new Error(texteErreurBase("Les verdicts du contrôle n'ont pas pu être enregistrés", errV));
  }
  return report.id;
}

/** Un tour : mécanique d'abord (sans modèle), jugé ensuite, notes calculées. */
async function unTour(
  editor: EditorContext,
  args: {
    stepId: string;
    stepCode: string;
    bookId: string;
    lang: string;
    grille: Grille;
    politique: Politique;
    round: number;
    chapterNo: number | null;
  },
): Promise<Tour> {
  const admin = await getAdminClient(editor);
  const startedAt = Date.now();
  const estRecit = args.stepCode === REDACTION_STEP_CODE;
  const codeControleur = estRecit ? "controle_recit" : "controle_plan";
  const prompt = await lirePromptControleur(editor, codeControleur);

  // Le livrable à juger, et pour un chapitre : le plan de SA version.
  let markdown = "";
  let targetArtifactId: string | null = null;
  let planText = "";
  let planVersion: number | null = null;
  let cible: ChapitrePlan | null = null;
  let toutLeLivre: string | null = null;

  if (estRecit) {
    const chapitres = await chapitresDeposes(admin, args.stepId);
    const vise = chapitres.find((c) => c.chapterNo === args.chapterNo) ?? chapitres[chapitres.length - 1];
    if (!vise) throw new Error("Aucun chapitre déposé sur cette étape : il n'y a rien à contrôler.");
    targetArtifactId = vise.artifactId;
    markdown = (await downloadArtifactText(editor, vise.storagePath)).text;
    const plan = await planDeLaVersion(editor, admin, {
      bookId: args.bookId,
      lang: args.lang,
      version: vise.planVersion,
    });
    planText = plan.text;
    planVersion = plan.version;
    cible = lirePlanChapitres(planText).chapitres.find((c) => c.chapterNo === vise.chapterNo) ?? null;

    // Au deuxième tour et au-delà, les critères transversaux se revérifient
    // sur le LIVRE ENTIER, pas seulement sur le chapitre touché.
    if (args.round > 1 && chapitres.length > 1) {
      const morceaux: string[] = [];
      for (const c of chapitres) {
        try {
          morceaux.push((await downloadArtifactText(editor, c.storagePath)).text);
        } catch {
          /* un chapitre illisible ne fait pas échouer le contrôle */
        }
      }
      toutLeLivre = morceaux.join("\n\n");
    }
  } else {
    const { data: arts } = await admin
      .from("artifacts")
      .select("id, storage_path, version")
      .eq("book_step_id", args.stepId)
      .eq("type", "plan")
      .order("version", { ascending: false })
      .limit(1);
    const vise = arts?.[0];
    if (!vise) throw new Error("Aucun plan déposé sur cette étape : il n'y a rien à contrôler.");
    targetArtifactId = vise.id;
    planVersion = vise.version;
    markdown = (await downloadArtifactText(editor, vise.storage_path)).text;
  }

  // 1) LES CRITÈRES MÉCANIQUES — aucun modèle n'est consulté.
  const mecaniques = verdictsMecaniques(
    args.grille.criteres,
    estRecit ? { kind: "recit", markdown, cible } : { kind: "plan", markdown },
  );

  // 2) LE CONTRÔLEUR — verdicts seulement.
  const juges = args.grille.criteres.filter((c) => c.species === "juge");
  let verdictsJuges: VerdictCalcule[] = [];
  let modelUsed: string | null = null;
  let runId: string | null = null;

  if (juges.length > 0) {
    // LE LANCEMENT EST JOURNALISÉ AVANT D'ÊTRE PAYÉ. Si la ligne ne peut pas
    // être écrite, le contrôle n'a pas le droit d'aboutir : aucun appel n'est
    // fait, et l'erreur brute de la base remonte telle quelle.
    const { data: run, error: errRun } = await admin
      .from("agent_runs")
      .insert({
        kind: "robot",
        robot_name: codeControleur,
        status: "en_cours",
        entity: "book_step",
        entity_id: args.stepId,
        book_step_id: args.stepId,
        model: prompt.model,
        mode: "controle",
        batch_current: args.round,
        batch_total: args.politique.strategy === "boucle" ? args.politique.maxRounds : 1,
        idempotency_key: `${codeControleur}:${args.stepId}:${args.round}:${new Date().toISOString()}`,
        ok: false,
        fields: 0,
        input_chars: 0,
        output_chars: 0,
        created_by: editor.userId,
      })
      .select("id")
      .single();
    if (errRun || !run)
      throw new Error(
        texteErreurBase(
          "Le lancement du contrôle n'a pas pu être journalisé : aucun appel n'a été fait",
          errRun,
        ),
      );
    runId = run.id;

    const decisions = await blocDecisionsPourRobot(editor, args.bookId);
    const matiere = [
      await ficheDuLivre(admin, args.bookId),
      decisions,
      estRecit && planText
        ? `PLAN DANS LA VERSION QUI A SERVI À ÉCRIRE CE TEXTE${planVersion !== null ? ` (v${planVersion})` : ""} — juge contre ce plan-là :\n${planText}`
        : null,
      estRecit && cible
        ? `CHAPITRE JUGÉ : ${cible.chapterNo} · ${cible.titre} — ${cible.pages} page(s), pages ${cible.firstPage} à ${cible.lastPage}.`
        : null,
      `LIVRABLE À JUGER :\n${markdown}`,
      toutLeLivre
        ? `LIVRE ENTIER — pour revérifier les critères transversaux (refrain, bouclage, notions déjà employées) :\n${toutLeLivre}`
        : null,
    ]
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .join("\n\n");

    try {
      const appel = await appelerControleur({
        prompt,
        criteres: args.grille.criteres,
        matiere,
        onProgress: async (info) => {
          // Seule écriture volontairement tolérante : elle ne fait qu'avancer
          // le modèle en cours, et la clôture la réécrit de toute façon. La
          // faire échouer couperait un appel déjà payé.
          if (runId) await admin.from("agent_runs").update({ model_used: info.modelUsed }).eq("id", runId);
        },
      });
      verdictsJuges = appel.verdicts;
      modelUsed = appel.modelUsed;
      const { error: errFin } = await admin
        .from("agent_runs")
        .update({
          status: "termine",
          ok: true,
          model_used: appel.modelUsed,
          cost_usd: appel.costUsd,
          duration_ms: Date.now() - startedAt,
          input_chars: appel.inputChars,
          output_chars: appel.outputChars,
          input_tokens: appel.inputTokens,
          output_tokens: appel.outputTokens,
          fields: appel.verdicts.length,
        })
        .eq("id", runId);
      // Durée, jetons et coût sont la seule preuve de la dépense : si elle ne
      // s'écrit pas, le contrôle échoue au lieu de passer pour gratuit.
      if (errFin)
        throw new Error(texteErreurBase("Le lancement du contrôle n'a pas pu être clôturé en base", errFin));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const { error: errEchec } = await admin
        .from("agent_runs")
        .update({
          status: "echoue",
          ok: false,
          error: message.slice(0, 2000),
          error_summary: message.slice(0, 300),
          duration_ms: Date.now() - startedAt,
        })
        .eq("id", runId);
      throw new Error(
        errEchec
          ? `${message} — de plus, l'échec n'a pas pu être journalisé : ${texteErreurBase("écriture refusée", errEchec)}`
          : message,
      );
    }
  }

  const verdicts = [...mecaniques, ...verdictsJuges];
  const notes = calculerNotes(verdicts, args.politique.passThreshold);
  const reportId = await enregistrerRapport(admin, editor, {
    bookStepId: args.stepId,
    gridId: args.grille.id,
    round: args.round,
    chapterNo: estRecit ? (cible?.chapterNo ?? args.chapterNo) : null,
    targetArtifactId,
    planVersion,
    agentRunId: runId,
    status: notes.ok ? "valide" : "a_revoir",
    stopReason: null,
    message: null,
    modelUsed,
    durationMs: Date.now() - startedAt,
    verdicts,
    notes,
  });

  return { reportId, verdicts, notes, chapterNo: estRecit ? (cible?.chapterNo ?? args.chapterNo) : null };
}

/* ------------------------------------------------------------------ */
/* LE PAQUET DE CORRECTION — CINQ COMPOSANTES, TOUTES OBLIGATOIRES     */
/* ------------------------------------------------------------------ */

function blocEchecs(verdicts: VerdictCalcule[]): string {
  const echecs = verdicts.filter((v) => v.verdict === "echoue");
  return [
    "CRITÈRES ÉCHOUÉS — la liste est exhaustive :",
    ...echecs.map(
      (v, i) =>
        `${i + 1}. ${v.label}${v.isBlocking ? " (BLOQUANT)" : ""} · localisation : ${v.location ?? "non précisée"}\n   ${v.explanation ?? ""}`,
    ),
    "",
    "CONSIGNE CADRE : NE MODIFIE QUE CE QUI EST SIGNALÉ CI-DESSUS. Tout ce qui n'est pas au rapport est réputé validé et reste STRICTEMENT INTACT : mêmes phrases, même découpage en pages, mêmes en-têtes.",
  ].join("\n");
}

function blocTransversaux(planText: string, chapitres: number[]): string {
  const lignes = planText
    .split(/\r?\n/)
    .filter((l) => MOT_TRANSVERSAL.test(l))
    .slice(0, 40);
  return [
    `ÉLÉMENTS TRANSVERSAUX qui touchent les chapitres ${chapitres.join(", ")} — une correction qui casse un transversal est une correction ratée :`,
    lignes.length > 0
      ? lignes.map((l) => `- ${l.trim()}`).join("\n")
      : "- Le plan ne nomme aucun refrain, bouclage ni notion récurrente : conserve à l'identique tout élément répété d'un chapitre à l'autre.",
  ].join("\n");
}

/** Le paquet : texte visé + voisins, contexte, décisions, transversaux, échecs. */
async function paquetCorrectionRecit(
  editor: EditorContext,
  args: {
    bookId: string;
    stepId: string;
    lang: string;
    chapterNo: number;
    planText: string;
    verdicts: VerdictCalcule[];
  },
): Promise<string> {
  const admin = await getAdminClient(editor);
  const chapitres = await chapitresDeposes(admin, args.stepId);
  const voisins = [args.chapterNo - 1, args.chapterNo, args.chapterNo + 1];
  const textes: string[] = [];
  for (const c of chapitres.filter((c) => voisins.includes(c.chapterNo))) {
    try {
      const { text } = await downloadArtifactText(editor, c.storagePath);
      textes.push(
        `${c.chapterNo === args.chapterNo ? "CHAPITRE À CORRIGER" : "CHAPITRE VOISIN — pour les raccords seulement, ne le réécris pas"} — chapitre ${c.chapterNo} :\n${text}`,
      );
    } catch {
      /* un voisin illisible ne bloque pas la correction */
    }
  }

  const plan = lirePlanChapitres(args.planText);
  const fiches = plan.chapitres
    .filter((c) => voisins.includes(c.chapterNo))
    .map((c) => `Chapitre ${c.chapterNo} · ${c.titre} — ${c.pages} page(s), pages ${c.firstPage} à ${c.lastPage}`)
    .join("\n");

  return [
    "PAQUET DE CORRECTION — tu ne réécris QUE le chapitre à corriger, et tu ne touches à rien d'autre.",
    textes.join("\n\n"),
    `PLAN DES CHAPITRES CONCERNÉS :\n${fiches}`,
    (await blocDecisionsPourRobot(editor, args.bookId)) ?? "Aucune décision tranchée de l'éditeur.",
    blocTransversaux(args.planText, voisins),
    blocEchecs(args.verdicts),
  ].join("\n\n");
}

/* ------------------------------------------------------------------ */
/* LA CONDUITE : AUCUN CONTRÔLE · UNE FOIS · BOUCLE                    */
/* ------------------------------------------------------------------ */

export async function controlerEtape(
  editor: EditorContext,
  args: { bookStepId: string; chapterNo?: number | undefined; forcer?: boolean | undefined },
): Promise<ResumeControle> {
  const admin = await getAdminClient(editor);
  const vide: ResumeControle = {
    reportId: null,
    rounds: 0,
    status: "desactive",
    message: "Contrôle qualité désactivé : la chaîne se comporte comme avant.",
    scoreGeneral: null,
    blockingFailed: 0,
  };

  if (!(await controleActif(editor))) return vide;
  const step = await lireEtape(admin, args.bookStepId);
  if (!step) throw new Error("Étape introuvable.");

  const politique = await lirePolitique(editor, step.id);
  if (politique.strategy === "aucun" && !args.forcer)
    return { ...vide, message: "Aucun contrôle n'est réglé sur cette étape." };

  const grille = await lireGrille(editor, { gridId: politique.gridId, stepCode: step.step_code });
  if (!grille || grille.criteres.length === 0)
    return {
      ...vide,
      status: "erreur",
      message: "Aucune grille de critères active pour cette étape : le contrôle n'a rien à vérifier.",
    };

  const estRecit = step.step_code === REDACTION_STEP_CODE;
  const estPlan = step.step_code === PLAN_STEP_CODE;
  if (!estRecit && !estPlan)
    return { ...vide, status: "erreur", message: "Cette étape n'a pas de contrôleur : plan et récit seulement." };

  const plafond = politique.strategy === "boucle" ? politique.maxRounds : 1;
  const scores: number[] = [];
  let dernier: Tour | null = null;
  let round = 1;

  try {
    for (;;) {
      dernier = await unTour(editor, {
        stepId: step.id,
        stepCode: step.step_code,
        bookId: step.book_id,
        lang: step.lang,
        grille,
        politique,
        round,
        chapterNo: args.chapterNo ?? null,
      });
      scores.push(dernier.notes.general ?? 0);

      if (dernier.notes.ok) {
        await cloreEtape(admin, step.id);
        return {
          reportId: dernier.reportId,
          rounds: round,
          status: "valide",
          message: `Validé au tour ${round} : ${dernier.notes.general ?? 0} %, aucun critère bloquant échoué.`,
          scoreGeneral: dernier.notes.general,
          blockingFailed: 0,
        };
      }

      // Pas validé : on corrige, si la stratégie l'autorise.
      if (round >= plafond) {
        if (politique.strategy === "une_fois") {
          const corr = await corriger(editor, { step, tour: dernier, grille });
          const message = `Un tour de contrôle, une correction, fin (tour ${round}) : à revoir manuellement. ${corr}`;
          await marquerRapport(admin, dernier.reportId, "a_revoir", message);
          await cloreEtape(admin, step.id);
          return {
            reportId: dernier.reportId,
            rounds: round,
            status: "a_revoir",
            message,
            scoreGeneral: dernier.notes.general,
            blockingFailed: dernier.notes.blockingFailed,
          };
        }
        if (politique.strategy === "boucle") {
          const message = `Arrêté au tour ${round}, plafond atteint. À revoir manuellement.`;
          await marquerRapport(admin, dernier.reportId, "arrete_plafond", message);
          await cloreEtape(admin, step.id);
          return {
            reportId: dernier.reportId,
            rounds: round,
            status: "arrete_plafond",
            message,
            scoreGeneral: dernier.notes.general,
            blockingFailed: dernier.notes.blockingFailed,
          };
        }
        // Contrôle demandé à la main sur une étape sans stratégie : on juge, on
        // ne corrige pas. Rien n'est validé d'office.
        const message = `Contrôle demandé à la main (tour ${round}) : non validé, à revoir manuellement. Aucune correction n'a été lancée.`;
        await marquerRapport(admin, dernier.reportId, "a_revoir", message);
        await cloreEtape(admin, step.id);
        return {
          reportId: dernier.reportId,
          rounds: round,
          status: "a_revoir",
          message,
          scoreGeneral: dernier.notes.general,
          blockingFailed: dernier.notes.blockingFailed,
        };
      }


      // STAGNATION : moins d'un point gagné d'un tour au suivant.
      if (scores.length >= 2) {
        const avant = scores[scores.length - 2] ?? 0;
        const apres = scores[scores.length - 1] ?? 0;
        if (apres - avant < 1) {
          const message = `Arrêté au tour ${round}, note stagnante (${avant} % puis ${apres} %). À revoir manuellement.`;
          await marquerRapport(admin, dernier.reportId, "arrete_stagnation", message);
          await cloreEtape(admin, step.id);
          return {
            reportId: dernier.reportId,
            rounds: round,
            status: "arrete_stagnation",
            message,
            scoreGeneral: dernier.notes.general,
            blockingFailed: dernier.notes.blockingFailed,
          };
        }
      }

      await corriger(editor, { step, tour: dernier, grille });
      round += 1;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (dernier) await marquerRapport(admin, dernier.reportId, "erreur", message);
    else
      await enregistrerRapport(admin, editor, {
        bookStepId: step.id,
        gridId: grille.id,
        round,
        chapterNo: args.chapterNo ?? null,
        targetArtifactId: null,
        planVersion: null,
        agentRunId: null,
        status: "erreur",
        stopReason: "erreur",
        message,
        modelUsed: null,
        durationMs: null,
        verdicts: [],
        notes: calculerNotes([], politique.passThreshold),
      });
    await cloreEtape(admin, step.id);
    return {
      reportId: dernier?.reportId ?? null,
      rounds: round,
      status: "erreur",
      message: `À revoir manuellement : ${message}`,
      scoreGeneral: dernier?.notes.general ?? null,
      blockingFailed: dernier?.notes.blockingFailed ?? 0,
    };
  }
}

/** Toute fonction qui ouvre un état le referme : l'étape revient à l'éditeur. */
async function cloreEtape(admin: Admin, stepId: string): Promise<void> {
  const { data, error: errLect } = await admin
    .from("book_steps")
    .select("status")
    .eq("id", stepId)
    .maybeSingle();
  if (errLect) throw new Error(texteErreurBase("L'état de l'étape n'a pas pu être lu", errLect));
  if (data?.status === "valide" || data?.status === "valide_hors_crm") return;
  const { error } = await admin
    .from("book_steps")
    .update({ status: "attend_validation", awaiting: "ben", updated_at: new Date().toISOString() })
    .eq("id", stepId);
  if (error) throw new Error(texteErreurBase("L'étape n'a pas pu être rendue à l'éditeur", error));
}

async function marquerRapport(
  admin: Admin,
  reportId: string,
  status: string,
  message: string,
): Promise<void> {
  const { error } = await admin
    .from("qc_reports")
    .update({ status, stop_reason: status, message })
    .eq("id", reportId);
  if (error) throw new Error(texteErreurBase("Le rapport de contrôle n'a pas pu être mis à jour", error));
}

/** LA CORRECTION : le juge ne réécrit pas ; c'est l'agent de fabrication qui corrige. */
async function corriger(
  editor: EditorContext,
  args: { step: { id: string; book_id: string; step_code: string; lang: string }; tour: Tour; grille: Grille },
): Promise<string> {
  const admin = await getAdminClient(editor);
  const echecs = args.tour.verdicts.filter((v) => v.verdict === "echoue");
  if (echecs.length === 0) return "Aucun critère échoué : rien à corriger.";

  if (args.step.step_code === REDACTION_STEP_CODE) {
    const chapterNo = args.tour.chapterNo;
    if (chapterNo === null) return "Chapitre visé inconnu : aucune correction lancée.";
    const chapitres = await chapitresDeposes(admin, args.step.id);
    const vise = chapitres.find((c) => c.chapterNo === chapterNo);
    const plan = await planDeLaVersion(editor, admin, {
      bookId: args.step.book_id,
      lang: args.step.lang,
      version: vise?.planVersion ?? null,
    });
    const paquet = await paquetCorrectionRecit(editor, {
      bookId: args.step.book_id,
      stepId: args.step.id,
      lang: args.step.lang,
      chapterNo,
      planText: plan.text,
      verdicts: args.tour.verdicts,
    });

    let message = "";
    let ok = false;
    let nouvelle: number | null = null;
    try {
      // SEUL LE CHAPITRE VISÉ EST RÉÉCRIT : l'agent récit reçoit le paquet et
      // dépose une NOUVELLE VERSION de ce seul artefact.
      const r = await executerChapitre(editor, { bookStepId: args.step.id, chapterNo, reason: paquet });
      nouvelle = r.artifactVersion;
      ok = true;
      message = `Chapitre ${chapterNo} corrigé : nouvelle version v${r.artifactVersion}, les précédentes sont conservées.`;
    } catch (e) {
      message = `Correction du chapitre ${chapterNo} refusée : ${e instanceof Error ? e.message : String(e)}`;
    }

    // Le récit assemblé devient périmé : il se reconstruit en nouvelle version.
    if (ok) {
      try {
        const a = await assemblerLeRecit(editor, args.step.id);
        message += ` Récit assemblé reconstruit en v${a.version}.`;
      } catch (e) {
        message += ` Récit assemblé non reconstruit : ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    const { error: errCorr } = await admin.from("qc_corrections").insert({
      report_id: args.tour.reportId,
      book_step_id: args.step.id,
      chapter_no: chapterNo,
      packet_chars: paquet.length,
      ok,
      message,
      ...(nouvelle !== null ? {} : {}),
    });
    if (errCorr) throw new Error(texteErreurBase("La correction n'a pas pu être journalisée", errCorr));
    return message;
  }

  // LE PLAN : le contrôleur juge, l'agent chapitres corrige, avec le paquet
  // écrit comme motif de révision — aucun agent existant n'est modifié.
  const paquet = [
    "PAQUET DE CORRECTION — issu du contrôle qualité.",
    (await blocDecisionsPourRobot(editor, args.step.book_id)) ?? "Aucune décision tranchée de l'éditeur.",
    blocEchecs(args.tour.verdicts),
  ].join("\n\n");

  const { error: errRev } = await admin.from("reviews").insert({
    book_step_id: args.step.id,
    decision: "revision_demandee",
    comment: paquet,
    artifact_id: null,
    author: editor.userId,
  });
  // Sans motif écrit, le robot corrigerait à l'aveugle : on n'y va pas.
  if (errRev)
    throw new Error(texteErreurBase("Le motif de révision n'a pas pu être écrit : aucune correction lancée", errRev));

  let message = "";
  let ok = false;
  try {
    const r = await executerLancementPlan(editor, { bookStepId: args.step.id, withReason: true });
    ok = true;
    message = `Plan corrigé : nouvelle version v${r.artifactVersion}, les précédentes sont conservées.`;
  } catch (e) {
    message = `Correction du plan refusée : ${e instanceof Error ? e.message : String(e)}`;
  }
  const { error: errCorrPlan } = await admin.from("qc_corrections").insert({
    report_id: args.tour.reportId,
    book_step_id: args.step.id,
    chapter_no: null,
    packet_chars: paquet.length,
    ok,
    message,
  });
  if (errCorrPlan)
    throw new Error(texteErreurBase("La correction n'a pas pu être journalisée", errCorrPlan));
  return message;
}

/**
 * LE CROCHET APRÈS FABRICATION. Sur off, ou sans stratégie, il ne fait
 * strictement RIEN : aucun appel, aucune ligne, aucun rapport.
 */
export async function controleApresFabrication(
  editor: EditorContext,
  args: { bookStepId: string; chapterNo?: number | undefined },
): Promise<ResumeControle | null> {
  try {
    if (!(await controleActif(editor))) return null;
    const politique = await lirePolitique(editor, args.bookStepId);
    if (politique.strategy === "aucun") return null;
    return await controlerEtape(editor, args);
  } catch {
    // Un contrôle qui échoue ne détruit jamais un livrable déjà déposé.
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* LA REPRISE MANUELLE DEPUIS UN RAPPORT                               */
/* ------------------------------------------------------------------ */

/**
 * « Renvoyer en correction » depuis un rapport existant. Une correction ne se
 * lance JAMAIS sans rapport de contrôle associé : c'est le rapport qui fournit
 * les critères échoués et leur localisation.
 */
export async function corrigerDepuisRapport(
  editor: EditorContext,
  reportId: string,
): Promise<string> {
  const admin = await getAdminClient(editor);
  const { data: rapport } = await admin
    .from("qc_reports")
    .select("id, book_step_id, grid_id, chapter_no")
    .eq("id", reportId)
    .maybeSingle();
  if (!rapport) throw new Error("Rapport de contrôle introuvable.");
  const step = await lireEtape(admin, rapport.book_step_id);
  if (!step) throw new Error("Étape introuvable.");
  const politique = await lirePolitique(editor, step.id);
  const grille = await lireGrille(editor, { gridId: rapport.grid_id, stepCode: step.step_code });
  if (!grille) throw new Error("Grille de critères introuvable.");

  const { data: verdicts } = await admin
    .from("qc_verdicts")
    .select("criterion_id, criterion_code, label, family, is_blocking, species, verdict, location, explanation")
    .eq("report_id", rapport.id);

  const tour: Tour = {
    reportId: rapport.id,
    chapterNo: rapport.chapter_no ?? null,
    verdicts: (verdicts ?? []).map((v) => ({
      criterionId: v.criterion_id ?? null,
      code: v.criterion_code,
      label: v.label,
      family: v.family as VerdictCalcule["family"],
      isBlocking: v.is_blocking,
      species: (v.species as "juge" | "mecanique") ?? "juge",
      verdict: v.verdict as "valide" | "echoue",
      location: v.location ?? null,
      explanation: v.explanation ?? null,
    })),
    notes: calculerNotes([], politique.passThreshold),
  };
  if (tour.verdicts.filter((v) => v.verdict === "echoue").length === 0)
    throw new Error("Ce rapport ne signale aucun critère échoué : il n'y a rien à corriger.");

  const message = await corriger(editor, { step, tour, grille });
  await cloreEtape(admin, step.id);
  return message;
}

/** « Forcer la validation » : décision d'éditeur, écrite en clair sur le rapport. */
export async function forcerValidation(
  editor: EditorContext,
  args: { reportId: string; comment: string },
): Promise<void> {
  const admin = await getAdminClient(editor);
  const { data: rapport } = await admin
    .from("qc_reports")
    .select("id, book_step_id")
    .eq("id", args.reportId)
    .maybeSingle();
  if (!rapport) throw new Error("Rapport de contrôle introuvable.");
  await admin
    .from("qc_reports")
    .update({
      status: "force_valide",
      stop_reason: "force_valide",
      message: `Validation forcée par l'éditeur : ${args.comment}`,
    })
    .eq("id", rapport.id);
}
