import type { EditorContext } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { appelerModele, cleConfiguree, fournisseurDuModele, secretDuModele } from "./robot-provider.server";
import {
  decouperPages,
  lirePlanChapitres,
  mesurerChapitre,
  MOTS_MAX,
  MOTS_MIN,
  type ChapitrePlan,
} from "./recit-calibrage";

/**
 * BRIQUE 9 — LE CONTRÔLE QUALITÉ, LE NOYAU.
 *
 * RÈGLES QUI COMMANDENT CE FICHIER :
 *  - UN JUGE N'EST JAMAIS UN RÉDACTEUR : ce module n'écrit aucun texte de livre.
 *  - AUCUNE NOTE N'EST DEMANDÉE À UN MODÈLE : le contrôleur rend des verdicts
 *    binaires ; les quatre notes de famille et la moyenne sont CALCULÉES ici.
 *  - LA MOYENNE NE VALIDE RIEN : la validation tient à zéro bloquant échoué ET
 *    au seuil de critères validés réglé sur l'étape.
 *  - LES CRITÈRES MÉCANIQUES ne passent jamais par un modèle : ils sont
 *    calculés par recit-calibrage.ts, qui est RÉUTILISÉ, jamais dupliqué.
 *  - L'INTERRUPTEUR GLOBAL est lu ici, une fois : sur off, aucun appel.
 */

export type Famille = "conformite" | "structure" | "pedagogie" | "langue";
export const FAMILLES: Famille[] = ["conformite", "structure", "pedagogie", "langue"];
export const NOM_FAMILLE: Record<Famille, string> = {
  conformite: "Conformité fiche",
  structure: "Structure",
  pedagogie: "Pédagogie",
  langue: "Langue",
};

export type Strategie = "aucun" | "une_fois" | "boucle";

export type Critere = {
  /** Nul pour une règle écrite : elle ne vient plus d'une table. */
  id: string | null;
  code: string;
  label: string;
  question: string;
  family: Famille;
  isBlocking: boolean;
  species: "juge" | "mecanique";
  mechanicKey: string | null;
};

export type Grille = {
  id: string;
  code: string;
  name: string;
  stepCode: string;
  criteres: Critere[];
};

export type VerdictCalcule = {
  criterionId: string | null;
  code: string;
  label: string;
  family: Famille;
  isBlocking: boolean;
  species: "juge" | "mecanique";
  verdict: "valide" | "echoue";
  location: string | null;
  explanation: string | null;
};

export type Notes = {
  general: number | null;
  parFamille: Record<Famille, number | null>;
  total: number;
  passed: number;
  blockingFailed: number;
  /** Zéro bloquant échoué ET seuil atteint. La moyenne ne décide rien. */
  ok: boolean;
};

export type Politique = {
  strategy: Strategie;
  maxRounds: number;
  passThreshold: number;
  gridId: string | null;
};

const CONTROLEUR_TIMEOUT_MS = 4 * 60 * 1000;

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

/* ------------------------------------------------------------------ */
/* L'INTERRUPTEUR ET LES RÉGLAGES                                      */
/* ------------------------------------------------------------------ */

/** Sur off, la chaîne se comporte exactement comme avant la brique 9. */
export async function controleActif(editor: EditorContext): Promise<boolean> {
  const admin = await getAdminClient(editor);
  const { data, error } = await admin.from("qc_settings").select("enabled").eq("id", true).maybeSingle();
  // Une lecture muette passerait pour « interrupteur à l'arrêt » : on préfère
  // l'erreur, sinon le contrôle se saute tout seul en silence.
  if (error) throw new Error(`L'interrupteur du contrôle qualité n'a pas pu être lu : ${error.message}`);
  return data?.enabled === true;
}

export const POLITIQUE_PAR_DEFAUT: Politique = {
  strategy: "aucun",
  maxRounds: 3,
  passThreshold: 80,
  gridId: null,
};

export async function lirePolitique(editor: EditorContext, bookStepId: string): Promise<Politique> {
  const admin = await getAdminClient(editor);
  const { data } = await admin
    .from("qc_step_policies")
    .select("strategy, max_rounds, pass_threshold, grid_id")
    .eq("book_step_id", bookStepId)
    .maybeSingle();
  if (!data) return POLITIQUE_PAR_DEFAUT;
  return {
    strategy: (data.strategy as Strategie) ?? "aucun",
    maxRounds: data.max_rounds ?? 3,
    passThreshold: data.pass_threshold ?? 80,
    gridId: data.grid_id ?? null,
  };
}

/** La grille de l'étape : celle réglée sur l'étape, sinon celle du type d'étape. */
export async function lireGrille(
  editor: EditorContext,
  args: { gridId: string | null; stepCode: string },
): Promise<Grille | null> {
  const admin = await getAdminClient(editor);
  let grid = null as { id: string; code: string; name: string; step_code: string } | null;
  if (args.gridId) {
    const { data } = await admin
      .from("qc_grids")
      .select("id, code, name, step_code")
      .eq("id", args.gridId)
      .maybeSingle();
    grid = data ?? null;
  }
  if (!grid) {
    const { data } = await admin
      .from("qc_grids")
      .select("id, code, name, step_code")
      .eq("step_code", args.stepCode)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    grid = data ?? null;
  }
  if (!grid) return null;

  const { data: criteres } = await admin
    .from("qc_criteria")
    .select("id, code, label, question, family, is_blocking, species, mechanic_key, sort_order")
    .eq("grid_id", grid.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return {
    id: grid.id,
    code: grid.code,
    name: grid.name,
    stepCode: grid.step_code,
    criteres: (criteres ?? []).map((c) => ({
      id: c.id,
      code: c.code,
      label: c.label,
      question: c.question,
      family: c.family as Famille,
      isBlocking: c.is_blocking,
      species: (c.species as "juge" | "mecanique") ?? "juge",
      mechanicKey: c.mechanic_key ?? null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* LES NOTES — CALCULÉES, JAMAIS DEMANDÉES                             */
/* ------------------------------------------------------------------ */

export function calculerNotes(verdicts: VerdictCalcule[], passThreshold: number): Notes {
  const parFamille: Record<Famille, number | null> = {
    conformite: null,
    structure: null,
    pedagogie: null,
    langue: null,
  };
  for (const f of FAMILLES) {
    const dedans = verdicts.filter((v) => v.family === f);
    if (dedans.length === 0) continue;
    parFamille[f] = Math.round((dedans.filter((v) => v.verdict === "valide").length / dedans.length) * 100);
  }
  const connues = FAMILLES.map((f) => parFamille[f]).filter((n): n is number => n !== null);
  const general = connues.length === 0 ? null : Math.round(connues.reduce((a, b) => a + b, 0) / connues.length);

  const total = verdicts.length;
  const passed = verdicts.filter((v) => v.verdict === "valide").length;
  const blockingFailed = verdicts.filter((v) => v.isBlocking && v.verdict === "echoue").length;
  const tauxValides = total === 0 ? 0 : Math.round((passed / total) * 100);

  return {
    general,
    parFamille,
    total,
    passed,
    blockingFailed,
    ok: blockingFailed === 0 && total > 0 && tauxValides >= passThreshold,
  };
}

/* ------------------------------------------------------------------ */
/* LES CRITÈRES MÉCANIQUES — recit-calibrage.ts, RÉUTILISÉ             */
/* ------------------------------------------------------------------ */

export type MatiereMecanique =
  | { kind: "recit"; markdown: string; cible: ChapitrePlan | null }
  | { kind: "plan"; markdown: string };

type Calcul = { ok: boolean; location: string; explanation: string };

/** Un verdict mécanique, calculé par le code. Aucun modèle n'est consulté. */
export function calculerMecanique(key: string | null, matiere: MatiereMecanique): Calcul {
  if (!key) return { ok: false, location: "", explanation: "Critère mécanique sans clé de calcul : rien n'a pu être vérifié." };

  if (matiere.kind === "plan") {
    const lecture = lirePlanChapitres(matiere.markdown);
    if (key === "plan_structure") {
      const soucis = lecture.problems.filter((p) => !p.includes("numérotation"));
      return {
        ok: lecture.chapitres.length > 0 && soucis.length === 0,
        location: lecture.chapitres.length > 0 ? `${lecture.chapitres.length} chapitre(s) lus` : "aucun chapitre lu",
        explanation:
          soucis.length === 0 && lecture.chapitres.length > 0
            ? `${lecture.chapitres.length} chapitre(s), ${lecture.totalPages} page(s) allouées.`
            : soucis.join(" · ") || "Le plan ne contient aucun chapitre lisible.",
      };
    }
    if (key === "plan_numerotation") {
      const soucis = lecture.problems.filter((p) => p.includes("numérotation"));
      return {
        ok: soucis.length === 0,
        location: lecture.chapitres.map((c) => c.chapterNo).join(", "),
        explanation: soucis.length === 0 ? "Numérotation continue." : soucis.join(" · "),
      };
    }
    return { ok: false, location: "", explanation: `Clé mécanique inconnue pour un plan : « ${key} ».` };
  }

  const cible = matiere.cible;
  if (!cible)
    return {
      ok: false,
      location: "",
      explanation: "Le plan n'alloue aucune page à ce chapitre : la mesure est impossible.",
    };
  const mesure = mesurerChapitre(matiere.markdown, {
    chapterNo: cible.chapterNo,
    firstPage: cible.firstPage,
    pages: cible.pages,
  });
  const brutes = decouperPages(matiere.markdown);

  switch (key) {
    case "nombre_pages": {
      const ok = mesure.pages.length === cible.pages;
      return {
        ok,
        location: `chapitre ${cible.chapterNo}`,
        explanation: ok
          ? `${mesure.pages.length} page(s), comme le plan l'alloue.`
          : `Le plan alloue ${cible.pages} page(s) ; le chapitre en contient ${mesure.pages.length}.`,
      };
    }
    case "pagination": {
      const soucis = mesure.problems.filter(
        (p) => p.includes("Numérotation") || p.includes("apparaît deux fois"),
      );
      return {
        ok: soucis.length === 0,
        location: `chapitre ${cible.chapterNo}, pages ${mesure.pages.map((p) => p.pageNo).join(", ")}`,
        explanation:
          soucis.length === 0
            ? `Pages ${cible.firstPage} à ${cible.lastPage}, à la suite et sans doublon.`
            : soucis.join(" · "),
      };
    }
    case "calibrage": {
      const fautives = mesure.pages.filter((p) => !p.ok);
      return {
        ok: fautives.length === 0,
        location:
          fautives.length === 0
            ? `chapitre ${cible.chapterNo}`
            : `chapitre ${cible.chapterNo}, ${fautives.map((p) => `page ${p.pageNo} (${p.words} mots)`).join(", ")}`,
        explanation:
          fautives.length === 0
            ? `Toutes les pages tiennent entre ${MOTS_MIN} et ${MOTS_MAX} mots.`
            : `Hors fourchette ${MOTS_MIN}–${MOTS_MAX} mots : ${fautives
                .map((p) => `page ${p.pageNo} — ${p.words} mots`)
                .join(" · ")}.`,
      };
    }
    case "entetes": {
      const vides = mesure.pages.filter((p) => p.empty);
      const ok = brutes.length > 0 && vides.length === 0;
      return {
        ok,
        location: vides.length > 0 ? `pages ${vides.map((p) => p.pageNo).join(", ")}` : `chapitre ${cible.chapterNo}`,
        explanation: ok
          ? `${brutes.length} en-tête(s) « ### Page N », aucune page vide.`
          : brutes.length === 0
            ? "Aucun en-tête « ### Page N » n'a été trouvé."
            : `Page(s) vide(s) : ${vides.map((p) => p.pageNo).join(", ")}.`,
      };
    }
    default:
      return { ok: false, location: "", explanation: `Clé mécanique inconnue pour un récit : « ${key} ».` };
  }
}

export function verdictsMecaniques(criteres: Critere[], matiere: MatiereMecanique): VerdictCalcule[] {
  return criteres
    .filter((c) => c.species === "mecanique")
    .map((c) => {
      const calcul = calculerMecanique(c.mechanicKey, matiere);
      return {
        criterionId: c.id,
        code: c.code,
        label: c.label,
        family: c.family,
        isBlocking: c.isBlocking,
        species: "mecanique" as const,
        verdict: calcul.ok ? ("valide" as const) : ("echoue" as const),
        location: calcul.location || null,
        explanation: calcul.explanation,
      };
    });
}

/* ------------------------------------------------------------------ */
/* LE CONTRÔLEUR — VERDICTS SEULEMENT                                  */
/* ------------------------------------------------------------------ */

export type PromptControleur = {
  promptId: string;
  name: string;
  versionId: string;
  version: number;
  content: string;
  model: string;
  webSearch: boolean;
};

/**
 * LA MÉTHODE DU CONTRÔLEUR — un seul prompt, quelle que soit l'étape.
 * C'est le SEUL prompt du contrôle qui part chez un fournisseur : les
 * vérifications de modèle, de fournisseur et de clé sont ici, et ici seulement.
 */
export async function lirePromptControleur(editor: EditorContext): Promise<PromptControleur> {
  const code = "controle";
  const admin = await getAdminClient(editor);
  const { data: prompt } = await admin
    .from("prompts")
    .select("id, name, active_version_id")
    .eq("code", code)
    .maybeSingle();
  if (!prompt) throw new Error(`Il manque le prompt de contrôle « ${code} » dans la bibliothèque.`);
  if (!prompt.active_version_id) throw new Error(`Le prompt « ${code} » n'a aucune version active.`);
  const { data: v } = await admin
    .from("prompt_versions")
    .select("id, version, content, model, web_search")
    .eq("id", prompt.active_version_id)
    .maybeSingle();
  if (!v) throw new Error(`Version de prompt introuvable pour « ${code} ».`);
  const model = (v.model ?? "").trim();
  if (model.length === 0)
    throw new Error(`La version active de « ${code} » ne précise aucun modèle : republiez-la avec un modèle.`);
  if (!fournisseurDuModele(model)) throw new Error(`Modèle inconnu de l'atelier : « ${model} ».`);
  if (!cleConfiguree(model))
    throw new Error(`Il manque la clé d'API ${secretDuModele(model)} dans les secrets du projet.`);
  return {
    promptId: prompt.id,
    name: prompt.name,
    versionId: v.id,
    version: v.version,
    content: v.content,
    model,
    webSearch: v.web_search ?? false,
  };
}

/* ------------------------------------------------------------------ */
/* LES RÈGLES ÉCRITES — LE CODE NE CONNAÎT QUE LEUR FORME              */
/* ------------------------------------------------------------------ */

export type PromptRegles = {
  promptId: string;
  code: string;
  name: string;
  versionId: string;
  version: number;
  content: string;
};

/** Quelle étape du livre lit quel prompt de règles. La correspondance est ici. */
export const CODE_REGLES: Record<string, string> = {
  plan: "regles_plan",
  redaction: "regles_recit",
};

/**
 * Un prompt de règles n'est JAMAIS envoyé seul à un fournisseur : il est lu
 * et recopié dans le message du contrôleur. Donc aucune vérification de
 * modèle, de fournisseur ni de clé ici — trois vérifications seulement.
 */
export async function lirePromptRegles(editor: EditorContext, stepCode: string): Promise<PromptRegles> {
  const code = CODE_REGLES[stepCode];
  if (!code) throw new Error(`Aucun prompt de règles n'est prévu pour l'étape « ${stepCode} ».`);
  const admin = await getAdminClient(editor);
  const { data: prompt } = await admin
    .from("prompts")
    .select("id, name, active_version_id")
    .eq("code", code)
    .maybeSingle();
  if (!prompt) throw new Error(`Il manque le prompt de règles « ${code} » dans la bibliothèque.`);
  if (!prompt.active_version_id) throw new Error(`Le prompt de règles « ${code} » n'a aucune version active.`);
  const { data: v } = await admin
    .from("prompt_versions")
    .select("id, version, content")
    .eq("id", prompt.active_version_id)
    .maybeSingle();
  if (!v) throw new Error(`Version de prompt introuvable pour « ${code} ».`);
  if ((v.content ?? "").trim().length === 0)
    throw new Error(`La version active de « ${code} » est vide : aucune règle à faire juger.`);
  return {
    promptId: prompt.id,
    code,
    name: prompt.name,
    versionId: v.id,
    version: v.version,
    content: v.content,
  };
}

export type ReglesEcrites = {
  preambule: string;
  criteres: Critere[];
  problemes: string[];
};

const ENTETE_REGLE = /^\[([^\]]*)\](.*)$/;

/**
 * LA FORME D'UNE DÉCLARATION, PAS SON CONTENU :
 *
 *   [code · famille · bloquant] Libellé court
 *   Le texte de la règle, sur autant de lignes que nécessaire.
 *
 * Tout ce qui précède la première déclaration est un préambule : transmis au
 * contrôleur, mais ne produit aucun verdict.
 *
 * Un fichier de règles illisible ne doit JAMAIS se traduire par « aucun
 * critère jugé, donc tout va bien » : les problèmes remontent, et le contrôle
 * échoue au lieu de valider.
 */
export function lireReglesEcrites(texte: string, codesMecaniques: string[] = []): ReglesEcrites {
  const lignes = String(texte ?? "").split(/\r?\n/);
  const problemes: string[] = [];
  const preambule: string[] = [];
  const criteres: Critere[] = [];
  const corps = new Map<string, string[]>();
  const mecaniques = new Set(codesMecaniques);
  const vus = new Set<string>();
  let courant: string | null = null;

  lignes.forEach((ligne, i) => {
    const m = ENTETE_REGLE.exec(ligne.trim());
    if (!m) {
      if (courant === null) preambule.push(ligne);
      else corps.get(courant)?.push(ligne);
      return;
    }
    const numero = i + 1;
    const champs = (m[1] ?? "").split("·").map((c) => c.trim());
    const label = (m[2] ?? "").trim();
    if (champs.length !== 3) {
      problemes.push(
        `Ligne ${numero} : une déclaration porte exactement trois champs séparés par « · » (code · famille · bloquant). Lu : « ${ligne.trim()} ».`,
      );
      courant = null;
      return;
    }
    const [code, famille, portee] = champs as [string, string, string];
    if (!/^[a-z0-9_]+$/.test(code)) {
      problemes.push(
        `Ligne ${numero} : code de règle invalide « ${code} » — lettres minuscules, chiffres et tirets bas seulement.`,
      );
      courant = null;
      return;
    }
    if (!FAMILLES.includes(famille as Famille)) {
      problemes.push(
        `Ligne ${numero} : famille inconnue « ${famille} » — attendu conformite, structure, pedagogie ou langue.`,
      );
      courant = null;
      return;
    }
    const normPortee = portee.toLowerCase();
    if (normPortee !== "bloquant" && normPortee !== "simple") {
      problemes.push(`Ligne ${numero} : troisième champ « ${portee} » — attendu « bloquant » ou « simple ».`);
      courant = null;
      return;
    }
    if (vus.has(code)) {
      problemes.push(`Ligne ${numero} : le code « ${code} » est déclaré deux fois.`);
      courant = null;
      return;
    }
    if (mecaniques.has(code)) {
      problemes.push(
        `Ligne ${numero} : le code « ${code} » est déjà celui d'une mesure calculée par le code : choisis-en un autre.`,
      );
      courant = null;
      return;
    }
    if (label.length === 0) {
      problemes.push(`Ligne ${numero} : la déclaration « ${code} » n'a pas de libellé après le crochet.`);
      courant = null;
      return;
    }
    vus.add(code);
    corps.set(code, []);
    courant = code;
    criteres.push({
      id: null,
      code,
      label,
      question: "",
      family: famille as Famille,
      isBlocking: normPortee === "bloquant",
      species: "juge",
      mechanicKey: null,
    });
  });

  for (const c of criteres) {
    const texteRegle = (corps.get(c.code) ?? []).join("\n").trim();
    if (texteRegle.length === 0)
      problemes.push(`Règle « ${c.code} » : aucune ligne de texte sous sa déclaration.`);
    c.question = texteRegle;
  }

  if (criteres.length === 0 && problemes.length === 0)
    problemes.push("Aucune déclaration de règle trouvée : il faut au moins une ligne « [code · famille · bloquant] Libellé ».");

  return { preambule: preambule.join("\n").trim(), criteres, problemes };
}


export function blocGrille(criteres: Critere[]): string {
  return [
    "GRILLE DE CRITÈRES — un verdict par critère, rien d'autre :",
    ...criteres.map(
      (c, i) =>
        `${i + 1}. code « ${c.code} » · famille ${NOM_FAMILLE[c.family]}${c.isBlocking ? " · BLOQUANT" : ""}\n   ${c.label} — ${c.question}`,
    ),
  ].join("\n");
}

type VerdictRendu = { code: string; verdict: string; location?: string; explanation?: string };

/**
 * LES SEULS MOTS QUI VALIDENT. Tout le reste — mot inconnu, champ vide,
 * critère absent, JSON illisible — ÉCHOUE. On ne valide jamais par défaut :
 * un contrôle qui valide sans juger serait pire que pas de contrôle.
 */
const MOTS_VALIDE = new Set(["valide", "valid", "ok", "pass", "passe", "reussi", "conforme", "oui", "true", "yes"]);

/** Les mots d'échec explicites : le contrôleur a bien jugé, il a dit non. */
const MOTS_ECHOUE = new Set([
  "echoue",
  "echec",
  "fail",
  "failed",
  "ko",
  "non",
  "non conforme",
  "false",
  "no",
  "refuse",
]);

/** Sans accents, sans casse : « Validé », « VALIDE », « validé » se lisent pareil. */
function normaliser(valeur: unknown): string {
  return String(valeur ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** On lit du JSON, et on n'invente rien : un critère non rendu est un échec. */
export function lireVerdictsRendus(texte: string, criteres: Critere[]): VerdictCalcule[] {
  let rendus: VerdictRendu[] = [];
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut >= 0 && fin > debut) {
    try {
      const parsed = JSON.parse(texte.slice(debut, fin + 1)) as { verdicts?: VerdictRendu[] };
      rendus = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
    } catch {
      rendus = [];
    }
  }
  const parCode = new Map(rendus.filter((r) => typeof r?.code === "string").map((r) => [r.code, r]));
  return criteres
    .filter((c) => c.species === "juge")
    .map((c) => {
      const rendu = parCode.get(c.code);
      const mot = normaliser(rendu?.verdict);
      const echoue = !rendu || !MOTS_VALIDE.has(mot);
      return {
        criterionId: c.id,
        code: c.code,
        label: c.label,
        family: c.family,
        isBlocking: c.isBlocking,
        species: "juge" as const,
        verdict: echoue ? ("echoue" as const) : ("valide" as const),
        location: (rendu?.location ?? "").trim() || null,
        explanation: !rendu
          ? "Aucun verdict rendu par le contrôleur pour ce critère : il est compté comme échoué."
          : mot.length === 0
            ? "Le contrôleur n'a pas dit s'il validait ce critère : il est compté comme échoué."
            : !MOTS_VALIDE.has(mot) && !MOTS_ECHOUE.has(mot)
              ? `Verdict illisible du contrôleur (« ${String(rendu.verdict ?? "")} ») : compté comme échoué. ${(rendu.explanation ?? "").trim()}`.trim()
              : (rendu.explanation ?? "").trim() || null,
      };
    });
}

export type AppelControleur = {
  verdicts: VerdictCalcule[];
  modelUsed: string;
  costUsd: number | null;
  inputChars: number;
  outputChars: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

/** L'appel au contrôleur, avec son délai maximal, comme les robots existants. */
export async function appelerControleur(args: {
  prompt: PromptControleur;
  criteres: Critere[];
  matiere: string;
  onProgress?: (info: { modelUsed: string }) => Promise<void> | void;
}): Promise<AppelControleur> {
  const juges = args.criteres.filter((c) => c.species === "juge");
  if (juges.length === 0)
    return {
      verdicts: [],
      modelUsed: args.prompt.model,
      costUsd: null,
      inputChars: 0,
      outputChars: 0,
      inputTokens: null,
      outputTokens: null,
    };

  const user = `${blocGrille(juges)}\n\n${args.matiere}`;
  const result = await avecDelai(
    appelerModele({
      model: args.prompt.model,
      webSearch: args.prompt.webSearch,
      system: args.prompt.content,
      user,
      ...(args.onProgress ? { onProgress: args.onProgress } : {}),
    }),
    CONTROLEUR_TIMEOUT_MS,
    `Contrôle interrompu : délai maximal de ${CONTROLEUR_TIMEOUT_MS / 60000} min dépassé.`,
  );
  if (result.text.trim().length === 0) throw new Error("Le contrôleur a répondu sans contenu.");

  return {
    verdicts: lireVerdictsRendus(result.text, args.criteres),
    modelUsed: result.modelUsed,
    costUsd: result.costUsd,
    inputChars: args.prompt.content.length + user.length,
    outputChars: result.text.length,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
