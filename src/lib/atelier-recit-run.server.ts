import type { EditorContext } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { artifactPath } from "./artifact-path";
import { downloadArtifactText, sha256Hex, uploadArtifactBytes } from "./atelier-artifacts.server";
import { blocDecisionsPourRobot, synchroniserDecisions } from "./decisions.server";
import { texteErreurBase, violeIndex } from "./db-error";
import { appelerModele, cleConfiguree, fournisseurDuModele, secretDuModele } from "./robot-provider.server";
import {
  assemblerRecit,
  lirePlanChapitres,
  mesurerChapitre,
  MOTS_MAX,
  MOTS_MAX_DUR,
  MOTS_MIN,
  MOTS_MIN_DUR,
  type ChapitrePlan,
  type MesureChapitre,
} from "./recit-calibrage";

/**
 * BRIQUE 8 — LE ROBOT DE RÉDACTION, CHAPITRE PAR CHAPITRE.
 *
 * Un lancement = UN chapitre. Le tuyau, la ligne de lancement, les artefacts
 * versionnés, les décisions de l'éditeur : tout est repris tel quel de la
 * brique 6. Ce qui s'ajoute ici, et rien d'autre :
 *   - le LOT (chapitre n sur m) inscrit sur le lancement ;
 *   - la MESURE du calibrage, bloquante, faite AVANT tout dépôt ;
 *   - la REPRISE : le chapitre suivant est celui qui n'a pas d'artefact ;
 *   - l'ASSEMBLAGE final en un seul « recit_txt ».
 *
 * Aucun chapitre déjà écrit ne se réécrit tout seul : seule une demande
 * explicite (« Réécrire ce chapitre ») produit une nouvelle version, et elle
 * ne touche que ce chapitre-là.
 */

export const ROBOT_RECIT = "recit";
export const REDACTION_STEP_CODE = "redaction";
const PLAN_STEP_CODE = "plan";
/** Un chapitre est court : au-delà, quelque chose est coincé. */
const APPEL_CHAPITRE_TIMEOUT_MS = 4 * 60 * 1000;

async function avecDelai<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type Admin = Awaited<ReturnType<typeof getAdminClient>>;

export type ChapitreEcrit = {
  chapterNo: number;
  artifactId: string;
  version: number;
  storagePath: string;
  createdAt: string;
  /** La version du plan qui a produit ce chapitre, si elle est connue. */
  planVersion: number | null;
  /** La version du prompt de rédaction qui a produit ce chapitre. */
  promptVersion: number | null;
  /** La dernière mesure connue de ce chapitre, si elle existe. */
  mesure: { ok: boolean; pages: { pageNo: number; words: number; ok: boolean }[]; problems: string[] } | null;
};


export type ContexteRecit = {
  stepCode: string;
  isRedactionStep: boolean;
  bookId: string;
  promptName: string | null;
  promptVersion: number | null;
  model: string | null;
  webSearch: boolean;
  keyConfigured: boolean;
  planReady: boolean;
  /** La version du plan actuellement en vigueur pour cette étape. */
  planVersion: number | null;
  planProblems: string[];
  chapitres: ChapitrePlan[];
  totalPages: number;
  ecrits: ChapitreEcrit[];
  nextChapter: number | null;
  assembled: { version: number; createdAt: string } | null;
  /** Un lancement travaille-t-il en ce moment sur cette étape, et sur quoi ? */
  running: boolean;
  runningSince: string | null;
  runningChapter: number | null;
  runningModel: string | null;
  lastRun: {
    status: string | null;
    modelUsed: string | null;
    durationMs: number | null;
    errorSummary: string | null;
    batchCurrent: number | null;
    createdAt: string;
  } | null;
  missing: string[];
  motsMin: number;
  motsMax: number;
  motsMinDur: number;
  motsMaxDur: number;
};

type Prepare = {
  step: { id: string; book_id: string; step_code: string; lang: string; status: string };
  planText: string | null;
  planVersion: number | null;
  plan: ReturnType<typeof lirePlanChapitres>;
  prompt: { id: string; name: string } | null;
  version: { id: string; version: number; content: string; model: string; web_search: boolean } | null;
  ecrits: ChapitreEcrit[];
  missing: string[];
};

/** Tout ce dont l'étape a besoin, lu une fois, sans rien inventer. */
async function preparer(editor: EditorContext, bookStepId: string): Promise<Prepare | null> {
  const admin = await getAdminClient(editor);
  const { data: step } = await admin
    .from("book_steps")
    .select("id, book_id, step_code, lang, status")
    .eq("id", bookStepId)
    .maybeSingle();
  if (!step) return null;

  const missing: string[] = [];
  if (step.step_code !== REDACTION_STEP_CODE)
    missing.push("Ce robot ne travaille que sur l'étape « Rédaction du récit ».");

  /**
   * 1) Le plan validé du livre : c'est lui qui fixe les pages de chaque
   * chapitre. Le plan est souvent porté par une étape de langue « shared »
   * alors que la rédaction est en « fr » : on prend l'étape de MÊME langue si
   * elle existe, sinon l'étape partagée. Filtrer sur la langue seule ferait
   * dire à l'écran que le livre n'a pas de plan — ce serait faux.
   */
  const { data: planSteps } = await admin
    .from("book_steps")
    .select("id, status, label_fr, lang")
    .eq("book_id", step.book_id)
    .eq("step_code", PLAN_STEP_CODE);
  const planStep =
    (planSteps ?? []).find((p) => p.lang === step.lang) ??
    (planSteps ?? []).find((p) => p.lang === "shared") ??
    (planSteps ?? [])[0] ??
    null;

  let planText: string | null = null;
  let planVersion: number | null = null;

  if (!planStep) missing.push("Ce livre n'a pas d'étape « Plan de chapitres ».");
  else if (planStep.status !== "valide" && planStep.status !== "valide_hors_crm")
    missing.push("Le plan de chapitres n'est pas validé : la rédaction attend un plan arrêté.");
  else {
    const { data: arts } = await admin
      .from("artifacts")
      .select("storage_path, version")
      .eq("book_step_id", planStep.id)
      .eq("type", "plan")
      .order("version", { ascending: false })
      .limit(1);
    const path = arts?.[0]?.storage_path;
    if (!path) missing.push("Aucun plan n'est déposé sur l'étape « Plan de chapitres ».");
    else {
      planVersion = arts?.[0]?.version ?? null;
      try {
        planText = (await downloadArtifactText(editor, path)).text;
      } catch (e) {
        missing.push(e instanceof Error ? e.message : String(e));
      }
    }
  }


  const plan = lirePlanChapitres(planText ?? "");
  if (planText !== null && !plan.ok) missing.push(...plan.problems);

  // 2) Le prompt actif de l'étape.
  const { data: prompt } = await admin
    .from("prompts")
    .select("id, name, active_version_id")
    .eq("step_code", REDACTION_STEP_CODE)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  let version: Prepare["version"] = null;
  if (!prompt) missing.push("Il manque un prompt pour l'étape « Rédaction du récit ».");
  else if (!prompt.active_version_id) missing.push("Le prompt de l'étape n'a aucune version active.");
  else {
    const { data: v } = await admin
      .from("prompt_versions")
      .select("id, version, content, model, web_search")
      .eq("id", prompt.active_version_id)
      .maybeSingle();
    if (!v) missing.push("Version de prompt introuvable.");
    else {
      const model = (v.model ?? "").trim();
      if (model.length === 0)
        missing.push("La version active du prompt ne précise aucun modèle : republiez-la avec un modèle.");
      else if (!fournisseurDuModele(model)) missing.push(`Modèle inconnu de l'atelier : « ${model} ».`);
      else if (!cleConfiguree(model))
        missing.push(`Il manque la clé d'API ${secretDuModele(model)} dans les secrets du projet.`);
      version = {
        id: v.id,
        version: v.version,
        content: v.content,
        model,
        web_search: v.web_search ?? false,
      };
    }
  }

  const ecrits = await lireChapitresEcrits(admin, step.id);

  return {
    step,
    planText,
    planVersion,
    plan,
    prompt: prompt ? { id: prompt.id, name: prompt.name } : null,
    version,
    ecrits,
    missing,
  };
}

/** La dernière version de chaque chapitre déposé, avec sa dernière mesure. */
async function lireChapitresEcrits(admin: Admin, stepId: string): Promise<ChapitreEcrit[]> {
  const { data: arts } = await admin
    .from("artifacts")
    .select("id, chapter_no, version, storage_path, created_at, plan_version, prompt_version_id")
    .eq("book_step_id", stepId)
    .eq("type", "chapitre")
    .order("chapter_no", { ascending: true })
    .order("version", { ascending: false });

  const derniers = new Map<number, NonNullable<typeof arts>[number]>();
  for (const a of arts ?? []) {
    const n = a.chapter_no;
    if (n === null) continue;
    if (!derniers.has(n)) derniers.set(n, a);
  }

  // Les versions de prompt citées par ces livrables, lues d'un seul coup.
  const promptVersionIds = [...new Set([...derniers.values()].map((a) => a.prompt_version_id).filter((v): v is string => !!v))];
  const versionsDePrompt = new Map<string, number>();
  if (promptVersionIds.length > 0) {
    const { data: pvs } = await admin
      .from("prompt_versions")
      .select("id, version")
      .in("id", promptVersionIds);
    for (const pv of pvs ?? []) versionsDePrompt.set(pv.id, pv.version);
  }

  const { data: mesures } = await admin
    .from("chapter_measures")
    .select("chapter_no, ok, pages, problems, created_at, artifact_id")
    .eq("book_step_id", stepId)
    .order("created_at", { ascending: false });

  const derniereMesure = new Map<number, NonNullable<typeof mesures>[number]>();
  for (const m of mesures ?? []) if (!derniereMesure.has(m.chapter_no)) derniereMesure.set(m.chapter_no, m);

  return [...derniers.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([chapterNo, a]) => {
      const m = derniereMesure.get(chapterNo);
      return {
        chapterNo,
        artifactId: a.id,
        version: a.version,
        storagePath: a.storage_path,
        createdAt: a.created_at,
        planVersion: a.plan_version ?? null,
        promptVersion: a.prompt_version_id ? versionsDePrompt.get(a.prompt_version_id) ?? null : null,
        mesure: m
          ? {
              ok: m.ok,
              pages: (m.pages as { pageNo: number; words: number; ok: boolean }[] | null) ?? [],
              problems: (m.problems as string[] | null) ?? [],
            }
          : null,
      };
    });

}

/** L'état complet de l'étape de rédaction : ce qui est écrit, ce qui reste. */
export async function etatRecit(editor: EditorContext, bookStepId: string): Promise<ContexteRecit | null> {
  const prepare = await preparer(editor, bookStepId);
  if (!prepare) return null;
  const admin = await getAdminClient(editor);

  const { data: assemblages } = await admin
    .from("artifacts")
    .select("version, created_at")
    .eq("book_step_id", prepare.step.id)
    .eq("type", "recit_txt")
    .order("version", { ascending: false })
    .limit(1);

  const ecritsNos = new Set(prepare.ecrits.map((e) => e.chapterNo));
  const next = prepare.plan.chapitres.find((c) => !ecritsNos.has(c.chapterNo))?.chapterNo ?? null;

  // Les lancements de cette étape : l'attente ne désigne un robot que s'il
  // travaille vraiment, et le lot en cours se lit sur la ligne elle-même.
  const { data: runs } = await admin
    .from("agent_runs")
    .select("status, model, model_used, duration_ms, error_summary, created_at, batch_current")
    .eq("book_step_id", prepare.step.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const enCours = (runs ?? []).find((r) => r.status === "en_cours") ?? null;
  const dernier = (runs ?? [])[0] ?? null;

  return {
    running: enCours !== null,
    runningSince: enCours?.created_at ?? null,
    runningChapter: enCours?.batch_current ?? null,
    runningModel: enCours?.model_used ?? enCours?.model ?? null,
    lastRun: dernier
      ? {
          status: dernier.status ?? null,
          modelUsed: dernier.model_used ?? null,
          durationMs: dernier.duration_ms ?? null,
          errorSummary: dernier.error_summary ?? null,
          batchCurrent: dernier.batch_current ?? null,
          createdAt: dernier.created_at,
        }
      : null,
    stepCode: prepare.step.step_code,
    isRedactionStep: prepare.step.step_code === REDACTION_STEP_CODE,
    bookId: prepare.step.book_id,
    promptName: prepare.prompt?.name ?? null,
    promptVersion: prepare.version?.version ?? null,
    model: prepare.version?.model ?? null,
    webSearch: prepare.version?.web_search ?? false,
    keyConfigured: prepare.version ? cleConfiguree(prepare.version.model) : false,
    planReady: prepare.plan.ok,
    planVersion: prepare.planVersion,
    planProblems: prepare.plan.problems,
    chapitres: prepare.plan.chapitres,
    totalPages: prepare.plan.totalPages,
    ecrits: prepare.ecrits,
    nextChapter: next,
    assembled: assemblages?.[0]
      ? { version: assemblages[0].version, createdAt: assemblages[0].created_at }
      : null,
    missing: prepare.missing,
    motsMin: MOTS_MIN,
    motsMax: MOTS_MAX,
    motsMinDur: MOTS_MIN_DUR,
    motsMaxDur: MOTS_MAX_DUR,
  };
}

export type ResultatChapitre = {
  chapterNo: number;
  artifactVersion: number;
  modelUsed: string;
  mesure: MesureChapitre;
  /** Le chapitre qui reste à écrire après celui-ci, s'il y en a un. */
  nextChapter: number | null;
};

/**
 * UN CHAPITRE, UN LANCEMENT. La mesure passe AVANT le dépôt : un chapitre hors
 * calibrage fait échouer le lancement et ne laisse aucun artefact derrière lui.
 */
export async function executerChapitre(
  editor: EditorContext,
  data: { bookStepId: string; chapterNo?: number | undefined; reason?: string | undefined },
): Promise<ResultatChapitre> {
  const admin = await getAdminClient(editor);
  const prepare = await preparer(editor, data.bookStepId);
  if (!prepare) throw new Error("Étape introuvable.");
  if (prepare.missing.length > 0) throw new Error(prepare.missing.join(" · "));
  const version = prepare.version;
  if (!version) throw new Error("Le prompt de l'étape n'a aucune version utilisable.");
  const step = prepare.step;

  const ecritsNos = new Set(prepare.ecrits.map((e) => e.chapterNo));
  const chapterNo =
    data.chapterNo ?? prepare.plan.chapitres.find((c) => !ecritsNos.has(c.chapterNo))?.chapterNo ?? null;
  if (chapterNo === null) throw new Error("Tous les chapitres du plan sont déjà écrits.");
  const cible = prepare.plan.chapitres.find((c) => c.chapterNo === chapterNo);
  if (!cible) throw new Error(`Le plan ne contient aucun chapitre ${chapterNo}.`);

  const reecriture = ecritsNos.has(chapterNo);
  const mode = reecriture ? "chapitre_revision" : "chapitre";

  const { data: book } = await admin
    .from("books")
    .select("id, title_fr, work_summary_fr, book_constraints_fr, intent_note_fr")
    .eq("id", step.book_id)
    .maybeSingle();
  if (!book) throw new Error("Livre introuvable.");

  // Les chapitres déjà écrits partent avec l'appel : la continuité en dépend.
  const precedents: string[] = [];
  for (const e of prepare.ecrits) {
    if (e.chapterNo >= chapterNo) continue;
    try {
      const { text } = await downloadArtifactText(editor, e.storagePath);
      precedents.push(text);
    } catch (err) {
      throw new Error(
        `Le chapitre ${e.chapterNo} déjà écrit n'a pas pu être relu : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Le texte précédent du chapitre, uniquement pour une réécriture demandée.
  let ancien: string | null = null;
  if (reecriture) {
    const dejaLa = prepare.ecrits.find((e) => e.chapterNo === chapterNo);
    if (dejaLa) {
      try {
        ancien = (await downloadArtifactText(editor, dejaLa.storagePath)).text;
      } catch {
        ancien = null;
      }
    }
  }

  const blocDecisions = await blocDecisionsPourRobot(editor, book.id);

  const startedAt = Date.now();
  const idempotencyKey = `recit:${step.id}:${chapterNo}:${new Date(startedAt).toISOString()}`;
  const { data: run, error: runErr } = await admin
    .from("agent_runs")
    .insert({
      kind: "robot",
      robot_name: ROBOT_RECIT,
      status: "en_cours",
      entity: "book_step",
      entity_id: step.id,
      book_step_id: step.id,
      model: version.model,
      mode,
      batch_current: chapterNo,
      batch_total: prepare.plan.chapitres.length,
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

  const matiere = [
    `Titre de travail du livre : ${book.title_fr}`,
    (book.book_constraints_fr ?? "").trim().length > 0
      ? `Consignes propres au livre :\n${book.book_constraints_fr}`
      : null,
    (book.intent_note_fr ?? "").trim().length > 0 ? `Ton et angle :\n${book.intent_note_fr}` : null,
    `Plan validé du livre :\n${prepare.planText ?? ""}`,
    blocDecisions,
    `CHAPITRE À ÉCRIRE : ${chapterNo} · ${cible.titre}`,
    `Pages allouées par le plan : ${cible.pages} — pages ${cible.firstPage} à ${cible.lastPage} en pagination continue. Chaque page fait de ${MOTS_MIN} à ${MOTS_MAX} mots.`,
    precedents.length > 0 ? `Chapitres déjà écrits :\n\n${precedents.join("\n\n")}` : null,
    ancien ? `Version précédente de ce chapitre :\n${ancien}` : null,
    data.reason ? `Motif de révision de l'éditeur pour ce chapitre :\n${data.reason}` : null,
  ]
    .filter((s): s is string => s !== null)
    .join("\n\n");

  const inputChars = version.content.length + matiere.length;

  const cloreEchec = async (
    message: string,
    partiel?: { text: string; modelUsed: string; outputTokens: number | null; inputTokens: number | null; truncated: boolean },
  ): Promise<never> => {
    await admin
      .from("agent_runs")
      .update({
        status: "echoue",
        ok: false,
        model_used: partiel?.modelUsed ?? version.model,
        error: message.slice(0, 2000),
        error_summary: message.slice(0, 300),
        duration_ms: Date.now() - startedAt,
        input_chars: inputChars,
        output_chars: partiel?.text.length ?? 0,
        output_tokens: partiel?.outputTokens ?? null,
        input_tokens: partiel?.inputTokens ?? null,
        truncated: partiel?.truncated ?? false,
      })
      .eq("id", run.id);
    await admin
      .from("book_steps")
      .update({ status: "echoue", awaiting: "ben", updated_at: new Date().toISOString() })
      .eq("id", step.id);
    throw new Error(message);
  };

  let result: Awaited<ReturnType<typeof appelerModele>> | undefined;
  try {
    result = await avecDelai(
      appelerModele({
        model: version.model,
        webSearch: version.web_search,
        system: version.content,
        user: matiere,
        onProgress: async (info) => {
          await admin
            .from("agent_runs")
            .update({ model_used: info.modelUsed })
            .eq("id", run.id)
            .eq("status", "en_cours");
        },
      }),
      APPEL_CHAPITRE_TIMEOUT_MS,
      `Appel interrompu : délai maximal de ${APPEL_CHAPITRE_TIMEOUT_MS / 60000} min dépassé pour le chapitre ${chapterNo}.`,
    );
    if (result.text.trim().length === 0) throw new Error("Le modèle a répondu sans contenu.");
    if (result.truncated) throw new Error("la réponse a été coupée : plafond de longueur atteint");
  } catch (e) {
    await cloreEchec(e instanceof Error ? e.message : String(e), result);
  }
  if (!result) throw new Error("Le lancement n'a rien produit.");

  // Un arrêt manuel pendant l'appel : la réponse tardive ne dépose rien.
  const { data: courant } = await admin
    .from("agent_runs")
    .select("status")
    .eq("id", run.id)
    .maybeSingle();
  if (courant?.status !== "en_cours") throw new Error("Le lancement a été arrêté.");

  // LA MESURE, AVANT TOUT DÉPÔT.
  const mesure = mesurerChapitre(result.text, {
    chapterNo,
    firstPage: cible.firstPage,
    pages: cible.pages,
  });

  await admin.from("chapter_measures").insert({
    book_step_id: step.id,
    chapter_no: chapterNo,
    agent_run_id: run.id,
    ok: mesure.ok,
    expected_pages: cible.pages,
    first_page: cible.firstPage,
    pages: mesure.pages,
    problems: [
      ...mesure.problems,
      ...mesure.warnings.map((w) => `Signalement (déposé quand même) : ${w}`),
    ],
  });

  if (!mesure.ok) {
    await cloreEchec(`Calibrage refusé (rien n'a été déposé) : ${mesure.problems.join(" · ")}`, result);
  }

  // LE DÉPÔT : octets d'abord, ligne ensuite.
  let artifactVersion = 1;
  let artifactId: string | null = null;
  try {
    const { data: derniere } = await admin
      .from("artifacts")
      .select("version")
      .eq("book_step_id", step.id)
      .eq("type", "chapitre")
      .eq("chapter_no", chapterNo)
      .order("version", { ascending: false })
      .limit(1);
    artifactVersion = (derniere?.[0]?.version ?? 0) + 1;

    const fileName = `chapitre-${String(chapterNo).padStart(2, "0")}-v${artifactVersion}.md`;
    const storagePath = artifactPath({
      bookId: step.book_id,
      stepCode: step.step_code,
      lang: step.lang,
      type: "chapitre",
      version: artifactVersion,
      fileName,
    });
    const bytes = new TextEncoder().encode(result.text).buffer as ArrayBuffer;
    await uploadArtifactBytes(editor, storagePath, bytes, "text/markdown; charset=utf-8");
    const checksum = await sha256Hex(bytes);

    const { data: inserted, error: artErr } = await admin
      .from("artifacts")
      .insert({
        book_step_id: step.id,
        type: "chapitre",
        chapter_no: chapterNo,
        plan_version: prepare.planVersion,
        version: artifactVersion,
        storage_path: storagePath,
        checksum,
        size_bytes: bytes.byteLength,
        origin: "robot",
        robot_run_id: run.id,
        prompt_version_id: version.id,
        created_by: editor.userId,
      })
      .select("id")
      .single();
    if (artErr || !inserted) throw new Error(texteErreurBase("Dépôt du chapitre refusé", artErr));
    artifactId = inserted.id;
  } catch (e) {
    await cloreEchec(e instanceof Error ? e.message : String(e), result);
  }

  // Accessoires : ils ne peuvent JAMAIS faire échouer un chapitre déposé.
  if (artifactId) {
    await admin.from("chapter_measures").update({ artifact_id: artifactId }).eq("agent_run_id", run.id);
  }
  try {
    await synchroniserDecisions(editor, {
      bookId: step.book_id,
      bookStepId: step.id,
      markdown: result.text,
    });
  } catch {
    /* les points à trancher sont un accessoire : le chapitre est déposé. */
  }

  await admin
    .from("agent_runs")
    .update({
      status: "termine",
      ok: true,
      model_used: result.modelUsed,
      cost_usd: result.costUsd,
      duration_ms: Date.now() - startedAt,
      input_chars: inputChars,
      output_chars: result.text.length,
      output_tokens: result.outputTokens,
      input_tokens: result.inputTokens,
      truncated: false,
      fields: mesure.pages.length,
    })
    .eq("id", run.id);

  const ecritsApres = new Set([...ecritsNos, chapterNo]);
  const next = prepare.plan.chapitres.find((c) => !ecritsApres.has(c.chapterNo))?.chapterNo ?? null;

  await admin
    .from("book_steps")
    .update({
      status: next === null ? "attend_validation" : "en_cours",
      awaiting: "ben",
      updated_at: new Date().toISOString(),
    })
    .eq("id", step.id);

  return { chapterNo, artifactVersion, modelUsed: result.modelUsed, mesure, nextChapter: next };
}

export type MaillonChapitre = { chapterNo: number; ok: boolean; message: string };

/**
 * Tous les chapitres restants, un par un. On s'arrête au PREMIER échec et on
 * dit où : rien ne se relance dans le dos de l'éditeur.
 */
export async function ecrireChapitresRestants(
  editor: EditorContext,
  bookStepId: string,
): Promise<MaillonChapitre[]> {
  const maillons: MaillonChapitre[] = [];
  for (let garde = 0; garde < 60; garde += 1) {
    const etat = await etatRecit(editor, bookStepId);
    if (!etat) return maillons;
    if (etat.nextChapter === null) return maillons;
    const cible = etat.nextChapter;
    try {
      const r = await executerChapitre(editor, { bookStepId, chapterNo: cible });
      maillons.push({
        chapterNo: cible,
        ok: true,
        message:
          `Chapitre ${cible} écrit (v${r.artifactVersion}) : ${r.mesure.pages.length} page(s), ${r.mesure.pages.map((p) => `p.${p.pageNo} ${p.words} mots`).join(" · ")}.` +
          (r.mesure.warnings.length > 0 ? ` Signalement : ${r.mesure.warnings.join(" · ")}` : ""),
      });
    } catch (e) {
      maillons.push({
        chapterNo: cible,
        ok: false,
        message: `Arrêt au chapitre ${cible} : ${e instanceof Error ? e.message : String(e)}`,
      });
      return maillons;
    }
  }
  return maillons;
}

/**
 * TOUT RÉÉCRIRE DEPUIS LE DÉBUT. Chaque chapitre déjà écrit est repris, du plus
 * petit numéro au plus grand, et chacun DÉPOSE UNE NOUVELLE VERSION : aucune
 * version précédente n'est touchée ni supprimée, elles restent consultables et
 * téléchargeables dans le dossier de l'étape. On s'arrête au premier échec.
 */
export async function reecrireTousLesChapitres(
  editor: EditorContext,
  bookStepId: string,
  reason?: string,
): Promise<MaillonChapitre[]> {
  const depart = await etatRecit(editor, bookStepId);
  if (!depart) throw new Error("Étape introuvable.");
  const cibles = depart.ecrits.map((e) => e.chapterNo).sort((a, b) => a - b);
  if (cibles.length === 0) throw new Error("Aucun chapitre n'est encore écrit : il n'y a rien à réécrire.");

  const maillons: MaillonChapitre[] = [];
  for (const cible of cibles) {
    try {
      const r = await executerChapitre(editor, {
        bookStepId,
        chapterNo: cible,
        ...(reason ? { reason } : {}),
      });
      maillons.push({
        chapterNo: cible,
        ok: true,
        message:
          `Chapitre ${cible} réécrit (nouvelle version v${r.artifactVersion}, les précédentes sont conservées) : ${r.mesure.pages.map((p) => `p.${p.pageNo} ${p.words} mots`).join(" · ")}.` +
          (r.mesure.warnings.length > 0 ? ` Signalement : ${r.mesure.warnings.join(" · ")}` : ""),
      });
    } catch (e) {
      maillons.push({
        chapterNo: cible,
        ok: false,
        message: `Arrêt au chapitre ${cible} : ${e instanceof Error ? e.message : String(e)}`,
      });
      return maillons;
    }
  }
  return maillons;
}

/* ------------------------------------------------------------------ */
/* L'ASSEMBLAGE DU RÉCIT                                               */
/* ------------------------------------------------------------------ */

export async function assemblerLeRecit(
  editor: EditorContext,
  bookStepId: string,
): Promise<{ version: number; pages: number }> {
  const admin = await getAdminClient(editor);
  const prepare = await preparer(editor, bookStepId);
  if (!prepare) throw new Error("Étape introuvable.");
  if (prepare.missing.length > 0) throw new Error(prepare.missing.join(" · "));
  const step = prepare.step;

  const chapitres: { chapterNo: number; markdown: string }[] = [];
  for (const e of prepare.ecrits) {
    const { text } = await downloadArtifactText(editor, e.storagePath);
    chapitres.push({ chapterNo: e.chapterNo, markdown: text });
  }

  const assemblage = assemblerRecit(prepare.plan.chapitres, chapitres);
  if (!assemblage.ok)
    throw new Error(`Assemblage refusé (rien n'a été déposé) : ${assemblage.problems.join(" · ")}`);

  const { data: derniere } = await admin
    .from("artifacts")
    .select("version")
    .eq("book_step_id", step.id)
    .eq("type", "recit_txt")
    .order("version", { ascending: false })
    .limit(1);
  const version = (derniere?.[0]?.version ?? 0) + 1;

  const fileName = `recit-v${version}.md`;
  const storagePath = artifactPath({
    bookId: step.book_id,
    stepCode: step.step_code,
    lang: step.lang,
    type: "recit_txt",
    version,
    fileName,
  });
  const bytes = new TextEncoder().encode(assemblage.text).buffer as ArrayBuffer;
  await uploadArtifactBytes(editor, storagePath, bytes, "text/markdown; charset=utf-8");
  const checksum = await sha256Hex(bytes);

  const { error } = await admin.from("artifacts").insert({
    book_step_id: step.id,
    type: "recit_txt",
    version,
    storage_path: storagePath,
    checksum,
    size_bytes: bytes.byteLength,
    origin: "robot",
    prompt_version_id: prepare.version?.id ?? null,
    created_by: editor.userId,
  });
  if (error) throw new Error(texteErreurBase("Dépôt du récit assemblé refusé", error));

  await admin
    .from("book_steps")
    .update({ status: "attend_validation", awaiting: "ben", updated_at: new Date().toISOString() })
    .eq("id", step.id);

  return { version, pages: assemblage.pagesFound.length };
}
