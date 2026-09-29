/**
 * BRIQUE 9 — LE CONTRAT DU FICHIER DE QUIZ.
 *
 * Module pur : aucun accès réseau. L'écran l'utilise pour la pré-analyse,
 * le serveur le relance avant toute écriture. Il ne renvoie jamais de phrase,
 * seulement des codes : la phrase se choisit dans les dictionnaires.
 */

export const QUIZ_FIELDS = [
  "chapitre",
  "page",
  "type",
  "question",
  "hebreu",
  "choix",
  "bonne",
  "explication",
] as const;
const ROOT_FIELDS = ["livre", "langue", "questions"];

export type QuizCode =
  | "syntax"
  | "notObject"
  | "livreMissing"
  | "livreMismatch"
  | "langueInvalid"
  | "langueMismatch"
  | "questionsEmpty"
  | "questionNotObject"
  | "unknownField"
  | "chapitreInvalid"
  | "chapitreUnknown"
  | "noPages"
  | "pageInvalid"
  | "pageUnknown"
  | "pageWrongChapter"
  | "typeInvalid"
  | "typeUnsupported"
  | "questionEmpty"
  | "hebreuInvalid"
  | "choixCount"
  | "choixEmpty"
  | "choixDup"
  | "bonneInvalid"
  | "bonneOut"
  | "explicationInvalid";

export type QuizProbleme = {
  niveau: "erreur" | "avertissement";
  question: number | null;
  champ: string | null;
  code: QuizCode;
  params: Record<string, string | number>;
};

export type QuizLigne = {
  chapter_no: number;
  page_no: number | null;
  kind: "qcm" | "trou";
  question: string;
  hebrew: string | null;
  options: string[];
  answer_index: number;
  explanation: string | null;
  sort_order: number;
};

export type QuizAnalyse = {
  erreurs: QuizProbleme[];
  avertissements: QuizProbleme[];
  resume: {
    total: number;
    parChapitre: { chapitre: number; n: number }[];
    parType: { type: string; n: number }[];
  };
  lignes: QuizLigne[];
};

export type PageRef = { page_no: number; chapter_no: number | null };

function positionSyntaxe(texte: string, message: string): { ligne: number; colonne: number } {
  const lc = /line (\d+) column (\d+)/i.exec(message);
  if (lc) return { ligne: Number(lc[1]), colonne: Number(lc[2]) };
  const pos = /position (\d+)/i.exec(message);
  const p = pos ? Number(pos[1]) : texte.length;
  const avant = texte.slice(0, p).split("\n");
  return { ligne: avant.length, colonne: (avant[avant.length - 1]?.length ?? 0) + 1 };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isPosInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function analyserQuizJson(
  contenu: string,
  slug: string,
  pages: PageRef[],
  edition?: "fr" | "en",
): QuizAnalyse {
  const erreurs: QuizProbleme[] = [];
  const avertissements: QuizProbleme[] = [];
  const vide: QuizAnalyse = {
    erreurs,
    avertissements,
    resume: { total: 0, parChapitre: [], parType: [] },
    lignes: [],
  };
  const err = (question: number | null, champ: string | null, code: QuizCode, params = {}) =>
    erreurs.push({ niveau: "erreur", question, champ, code, params });
  const warn = (question: number | null, champ: string | null, code: QuizCode, params = {}) =>
    avertissements.push({ niveau: "avertissement", question, champ, code, params });

  let racine: unknown;
  try {
    racine = JSON.parse(contenu);
  } catch (e) {
    const { ligne, colonne } = positionSyntaxe(contenu, e instanceof Error ? e.message : "");
    err(null, null, "syntax", { ligne, colonne });
    return vide;
  }
  if (!isObj(racine)) {
    err(null, null, "notObject");
    return vide;
  }
  for (const k of Object.keys(racine))
    if (!ROOT_FIELDS.includes(k)) warn(null, k, "unknownField", { champ: k });

  const livre = text(racine["livre"]);
  if (!livre) err(null, "livre", "livreMissing");
  else if (livre !== slug) err(null, "livre", "livreMismatch", { attendu: slug, recu: livre });

  const langue = racine["langue"];
  if (langue !== "fr" && langue !== "en") err(null, "langue", "langueInvalid");
  // Un fichier ne se dépose que sur l'édition de sa langue.
  else if (edition && langue !== edition)
    err(null, "langue", "langueMismatch", { recu: langue, attendu: edition });

  const qs = racine["questions"];
  if (!Array.isArray(qs) || qs.length === 0) {
    err(null, "questions", "questionsEmpty");
    return vide;
  }

  const chapitres = new Set(pages.map((p) => p.chapter_no).filter((c): c is number => c != null));
  const pageChap = new Map(pages.map((p) => [p.page_no, p.chapter_no]));
  if (pages.length === 0) warn(null, "chapitre", "noPages");

  const lignes: QuizLigne[] = [];
  qs.forEach((q, i) => {
    const n = i + 1;
    if (!isObj(q)) {
      err(n, null, "questionNotObject");
      return;
    }
    for (const k of Object.keys(q))
      if (!(QUIZ_FIELDS as readonly string[]).includes(k)) warn(n, k, "unknownField", { champ: k });

    const chapitre = q["chapitre"];
    if (!isPosInt(chapitre)) err(n, "chapitre", "chapitreInvalid");
    else if (pages.length > 0 && !chapitres.has(chapitre))
      err(n, "chapitre", "chapitreUnknown", { chapitre });

    const page = q["page"];
    if (page !== undefined && page !== null) {
      if (!isPosInt(page)) err(n, "page", "pageInvalid");
      else if (pages.length > 0) {
        if (!pageChap.has(page)) err(n, "page", "pageUnknown", { page });
        else if (isPosInt(chapitre) && pageChap.get(page) !== chapitre)
          err(n, "page", "pageWrongChapter", { page, chapitre });
      }
    }

    const type = q["type"];
    if (type === "ordre" || type === "ecoute") err(n, "type", "typeUnsupported", { type });
    else if (type !== "qcm" && type !== "trou") err(n, "type", "typeInvalid");

    const question = text(q["question"]);
    if (!question) err(n, "question", "questionEmpty");

    const hebreu = q["hebreu"];
    if (hebreu !== undefined && hebreu !== null && typeof hebreu !== "string")
      err(n, "hebreu", "hebreuInvalid");

    const choixBrut = q["choix"];
    let choix: string[] = [];
    if (!Array.isArray(choixBrut) || choixBrut.length < 2 || choixBrut.length > 6) {
      err(n, "choix", "choixCount");
    } else {
      choix = choixBrut.map(text);
      if (choixBrut.some((c) => typeof c !== "string") || choix.some((c) => !c))
        err(n, "choix", "choixEmpty");
      const vus = new Set<string>();
      for (const c of choix) {
        if (c && vus.has(c)) {
          err(n, "choix", "choixDup", { valeur: c });
          break;
        }
        vus.add(c);
      }
    }

    const bonne = q["bonne"];
    if (typeof bonne !== "number" || !Number.isInteger(bonne) || bonne < 0)
      err(n, "bonne", "bonneInvalid");
    else if (choix.length > 0 && bonne >= choix.length)
      err(n, "bonne", "bonneOut", { bonne, n: choix.length, max: choix.length - 1 });

    const explication = q["explication"];
    if (explication !== undefined && explication !== null && typeof explication !== "string")
      err(n, "explication", "explicationInvalid");

    const expl = text(explication) || null;
    lignes.push({
      chapter_no: isPosInt(chapitre) ? chapitre : 0,
      page_no: isPosInt(page) ? page : null,
      kind: type === "trou" ? "trou" : "qcm",
      question,
      hebrew: text(hebreu) || null,
      options: choix,
      answer_index: typeof bonne === "number" ? bonne : 0,
      explanation: expl,
      sort_order: n,
    });
  });

  const parChap = new Map<number, number>();
  const parType = new Map<string, number>();
  for (const l of lignes) {
    parChap.set(l.chapter_no, (parChap.get(l.chapter_no) ?? 0) + 1);
    parType.set(l.kind, (parType.get(l.kind) ?? 0) + 1);
  }
  return {
    erreurs,
    avertissements,
    resume: {
      total: qs.length,
      parChapitre: [...parChap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([chapitre, n]) => ({ chapitre, n })),
      parType: [...parType.entries()].map(([type, n]) => ({ type, n })),
    },
    lignes,
  };
}

/** Le quiz en base, remis exactement au format du dépôt. */
export function exporterQuizJson(
  slug: string,
  rows: {
    chapter_no: number;
    page_no: number | null;
    kind: string;
    question: string;
    hebrew: string | null;
    options: unknown;
    answer_index: number;
    explanation: string | null;
  }[],
  langue: "fr" | "en",
): string {
  const questions = rows.map((r) => {
    const q: Record<string, unknown> = { chapitre: r.chapter_no };
    if (r.page_no != null) q["page"] = r.page_no;
    q["type"] = r.kind;
    q["question"] = r.question;
    if (r.hebrew) q["hebreu"] = r.hebrew;
    q["choix"] = Array.isArray(r.options) ? r.options.map(String) : [];
    q["bonne"] = r.answer_index;
    if (r.explanation) q["explication"] = r.explanation;
    return q;
  });
  return JSON.stringify({ livre: slug, langue, questions }, null, 2);
}

/** Message français d'un problème d'analyse (admin). */
export function messageQuiz(p: QuizProbleme): string {
  const v = p.params;
  const m: Record<QuizCode, string> = {
    syntax: `JSON illisible (ligne ${v["ligne"]}, colonne ${v["colonne"]}).`,
    notObject: "Le fichier doit être un objet JSON { livre, langue, questions }.",
    livreMissing: "Le champ « livre » manque.",
    livreMismatch: `Le fichier est pour le livre « ${v["recu"]} », pas pour « ${v["attendu"]} ».`,
    langueInvalid: "Le champ « langue » doit valoir \"fr\" ou \"en\".",
    langueMismatch: `Ce fichier est en langue « ${v["recu"]} » : il ne peut pas être déposé dans l'édition « ${v["attendu"]} ».`,
    questionsEmpty: "La liste « questions » est vide ou absente.",
    questionNotObject: "La question n'est pas un objet.",
    unknownField: `Champ inconnu « ${v["champ"]} » (ignoré).`,
    chapitreInvalid: "« chapitre » doit être un entier positif.",
    chapitreUnknown: `Le chapitre ${v["chapitre"]} n'existe pas dans les pages du livre.`,
    noPages: "Le livre n'a encore aucune page : chapitres et pages ne peuvent pas être vérifiés.",
    pageInvalid: "« page » doit être un entier positif.",
    pageUnknown: `La page ${v["page"]} n'existe pas.`,
    pageWrongChapter: `La page ${v["page"]} n'appartient pas au chapitre ${v["chapitre"]}.`,
    typeInvalid: "« type » doit valoir \"qcm\" ou \"trou\".",
    typeUnsupported: `Le type « ${v["type"]} » n'est pas pris en charge.`,
    questionEmpty: "« question » est vide.",
    hebreuInvalid: "« hebreu » doit être un texte.",
    choixCount: "« choix » doit contenir de 2 à 6 réponses.",
    choixEmpty: "Un des choix est vide.",
    choixDup: `Le choix « ${v["valeur"]} » apparaît deux fois.`,
    bonneInvalid: "« bonne » doit être un entier (0 = premier choix).",
    bonneOut: `« bonne » vaut ${v["bonne"]} mais il n'y a que ${v["n"]} choix (0 à ${v["max"]}).`,
    explicationInvalid: "« explication » doit être un texte.",
  };
  return (p.question != null ? `Question ${p.question} : ` : "") + m[p.code];
}
