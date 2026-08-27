/**
 * BRIQUE 8 — LA MESURE DU CALIBRAGE. Module PUR : aucun secret, aucun client,
 * aucune base. On ne croit pas le modèle sur parole, on compte.
 *
 * CE QU'EST UN MOT : une suite de lettres ou de chiffres, apostrophe INTERNE
 * comprise (« l'avion » = un mot, « aujourd'hui » = un mot). Le tiret sépare
 * (« porte-avions » = deux mots), la ponctuation ne compte jamais, et un tiret
 * cadratin de dialogue seul n'est pas un mot.
 *
 * CE QU'EST UNE PAGE : une ligne « ### Page N », puis toutes les lignes qui
 * suivent jusqu'au prochain titre (# quelconque). Les sections « ## Contrôle »
 * et « ## Points à trancher » s'arrêtent donc d'elles-mêmes : elles ne sont
 * jamais comptées dans le texte du livre.
 */

/** La fourchette VISÉE : hors d'elle, la page est signalée, mais le chapitre est déposé. */
export const MOTS_MIN = 165;
export const MOTS_MAX = 210;

/** La fourchette BLOQUANTE : hors d'elle, le lancement échoue et rien n'est déposé. */
export const MOTS_MIN_DUR = 160;
export const MOTS_MAX_DUR = 215;

const MOT = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;


export function compterMots(texte: string): number {
  return texte.match(MOT)?.length ?? 0;
}

/* ------------------------------------------------------------------ */
/* LE PLAN : combien de chapitres, combien de pages chacun             */
/* ------------------------------------------------------------------ */

export type ChapitrePlan = {
  chapterNo: number;
  titre: string;
  pages: number;
  /** Numéro de la première page du chapitre, en pagination continue. */
  firstPage: number;
  lastPage: number;
};

export type LecturePlan = {
  ok: boolean;
  chapitres: ChapitrePlan[];
  totalPages: number;
  problems: string[];
};

const TITRE_CHAPITRE = /^#{1,6}\s*chapitre\s+(\d+)\s*(?:[·:.\-–—]\s*(.*?))?\s*$/i;
const LIGNE_PAGES = /^\s*(?:[-*]\s*)?\*{0,2}\s*pages?\s*\*{0,2}\s*:\s*\*{0,2}\s*(\d+)/i;
const TITRE_PAGE = /^#{1,6}\s*page\s+(\d+)\s*$/i;

/** Lit le plan déposé : « ## Chapitre N · titre » puis « Pages : n ». */
export function lirePlanChapitres(markdown: string): LecturePlan {
  const lignes = markdown.split(/\r?\n/);
  const trouves: { chapterNo: number; titre: string; pages: number | null }[] = [];
  let courant: { chapterNo: number; titre: string; pages: number | null } | null = null;

  for (const ligne of lignes) {
    const titre = TITRE_CHAPITRE.exec(ligne);
    if (titre) {
      if (courant) trouves.push(courant);
      courant = {
        chapterNo: Number(titre[1]),
        titre: (titre[2] ?? "").trim(),
        pages: null,
      };
      continue;
    }
    if (courant && courant.pages === null) {
      const pages = LIGNE_PAGES.exec(ligne);
      if (pages) courant.pages = Number(pages[1]);
    }
  }
  if (courant) trouves.push(courant);

  const problems: string[] = [];
  if (trouves.length === 0)
    problems.push("Le plan ne contient aucun titre de chapitre au format « ## Chapitre N · titre ».");

  // Un même chapitre peut apparaître deux fois (tableau de répartition puis
  // fiche) : on retient la première occurrence qui annonce ses pages.
  const parNumero = new Map<number, { titre: string; pages: number | null }>();
  for (const c of trouves) {
    const deja = parNumero.get(c.chapterNo);
    if (!deja || (deja.pages === null && c.pages !== null))
      parNumero.set(c.chapterNo, { titre: c.titre || (deja?.titre ?? ""), pages: c.pages ?? deja?.pages ?? null });
  }

  const numeros = [...parNumero.keys()].sort((a, b) => a - b);
  numeros.forEach((n, i) => {
    if (n !== i + 1)
      problems.push(`La numérotation des chapitres du plan est trouée : chapitre ${i + 1} attendu, ${n} trouvé.`);
  });

  const chapitres: ChapitrePlan[] = [];
  let curseur = 1;
  for (const n of numeros) {
    const c = parNumero.get(n)!;
    if (c.pages === null || c.pages < 1) {
      problems.push(`Le plan n'annonce aucun nombre de pages pour le chapitre ${n} (ligne « Pages : n »).`);
      continue;
    }
    chapitres.push({
      chapterNo: n,
      titre: c.titre,
      pages: c.pages,
      firstPage: curseur,
      lastPage: curseur + c.pages - 1,
    });
    curseur += c.pages;
  }

  return {
    ok: problems.length === 0 && chapitres.length > 0,
    chapitres,
    totalPages: curseur - 1,
    problems,
  };
}

/* ------------------------------------------------------------------ */
/* LE CHAPITRE RENDU : page par page, le compte réel                   */
/* ------------------------------------------------------------------ */

export type MesurePage = { pageNo: number; words: number; ok: boolean; empty: boolean };

export type MesureChapitre = {
  ok: boolean;
  pages: MesurePage[];
  problems: string[];
  totalWords: number;
};

type PageBrute = { pageNo: number; texte: string };

/** Découpe le rendu en pages : « ### Page N » ouvre, tout autre titre ferme. */
export function decouperPages(markdown: string): PageBrute[] {
  const pages: PageBrute[] = [];
  let courant: PageBrute | null = null;
  for (const ligne of markdown.split(/\r?\n/)) {
    const titrePage = TITRE_PAGE.exec(ligne);
    if (titrePage) {
      if (courant) pages.push(courant);
      courant = { pageNo: Number(titrePage[1]), texte: "" };
      continue;
    }
    if (/^\s*#{1,6}\s/.test(ligne)) {
      if (courant) pages.push(courant);
      courant = null;
      continue;
    }
    if (courant) courant.texte += `${ligne}\n`;
  }
  if (courant) pages.push(courant);
  return pages;
}

export function mesurerChapitre(
  markdown: string,
  attendu: { chapterNo: number; firstPage: number; pages: number },
): MesureChapitre {
  const brutes = decouperPages(markdown);
  const pages: MesurePage[] = brutes.map((p) => {
    const words = compterMots(p.texte);
    return {
      pageNo: p.pageNo,
      words,
      empty: p.texte.trim().length === 0,
      ok: words >= MOTS_MIN && words <= MOTS_MAX && p.texte.trim().length > 0,
    };
  });

  const problems: string[] = [];
  if (pages.length === 0)
    problems.push("Aucune page trouvée : le rendu ne contient aucune ligne « ### Page N ».");
  if (pages.length !== attendu.pages)
    problems.push(
      `Le plan alloue ${attendu.pages} page(s) au chapitre ${attendu.chapterNo} ; le rendu en contient ${pages.length}.`,
    );

  const attendus: number[] = [];
  for (let i = 0; i < attendu.pages; i += 1) attendus.push(attendu.firstPage + i);
  const vus = new Set<number>();
  pages.forEach((p, i) => {
    if (vus.has(p.pageNo)) problems.push(`La page ${p.pageNo} apparaît deux fois.`);
    vus.add(p.pageNo);
    const veut = attendus[i];
    if (veut !== undefined && p.pageNo !== veut)
      problems.push(
        `Numérotation discontinue : page ${veut} attendue en position ${i + 1}, page ${p.pageNo} trouvée.`,
      );
  });

  for (const p of pages) {
    if (p.empty) {
      problems.push(`La page ${p.pageNo} est vide.`);
      continue;
    }
    if (p.words < MOTS_MIN)
      problems.push(`Page ${p.pageNo} : ${p.words} mots — sous le plancher de ${MOTS_MIN}.`);
    else if (p.words > MOTS_MAX)
      problems.push(`Page ${p.pageNo} : ${p.words} mots — au-dessus du plafond de ${MOTS_MAX}.`);
  }

  return {
    ok: problems.length === 0,
    pages,
    problems,
    totalWords: pages.reduce((n, p) => n + p.words, 0),
  };
}

/* ------------------------------------------------------------------ */
/* L'ASSEMBLAGE : les chapitres à la suite, pagination vérifiée        */
/* ------------------------------------------------------------------ */

export type Assemblage = {
  ok: boolean;
  text: string;
  pagesFound: number[];
  totalPages: number;
  problems: string[];
};

/**
 * Recompose le récit : titre de chapitre, puis ses pages, dans l'ordre du plan.
 * Les sections de service (Contrôle, Points à trancher) ne sont pas reprises :
 * ce fichier est le texte du livre, pas le journal du robot.
 */
export function assemblerRecit(
  plan: ChapitrePlan[],
  chapitres: { chapterNo: number; markdown: string }[],
): Assemblage {
  const problems: string[] = [];
  const parNumero = new Map(chapitres.map((c) => [c.chapterNo, c.markdown]));
  const morceaux: string[] = [];
  const pagesFound: number[] = [];

  for (const c of plan) {
    const md = parNumero.get(c.chapterNo);
    if (md === undefined) {
      problems.push(`Le chapitre ${c.chapterNo} manque : il n'a pas encore été écrit.`);
      continue;
    }
    const pages = decouperPages(md);
    if (pages.length === 0) problems.push(`Le chapitre ${c.chapterNo} ne contient aucune page.`);
    morceaux.push(`## Chapitre ${c.chapterNo}${c.titre ? ` · ${c.titre}` : ""}`);
    for (const p of pages) {
      pagesFound.push(p.pageNo);
      morceaux.push(`### Page ${p.pageNo}`, p.texte.trim());
    }
  }

  const total = plan.reduce((n, c) => n + c.pages, 0);
  const attendus: number[] = [];
  for (let i = 1; i <= total; i += 1) attendus.push(i);
  const vus = new Set(pagesFound);
  for (const n of attendus) if (!vus.has(n)) problems.push(`La page ${n} manque dans le récit assemblé.`);
  const doublons = pagesFound.filter((n, i) => pagesFound.indexOf(n) !== i);
  for (const n of [...new Set(doublons)]) problems.push(`La page ${n} apparaît deux fois dans le récit assemblé.`);
  for (let i = 1; i < pagesFound.length; i += 1)
    if ((pagesFound[i] ?? 0) !== (pagesFound[i - 1] ?? 0) + 1)
      problems.push(
        `Rupture de pagination entre la page ${pagesFound[i - 1]} et la page ${pagesFound[i]}.`,
      );

  return {
    ok: problems.length === 0,
    text: `${morceaux.join("\n\n")}\n`,
    pagesFound,
    totalPages: total,
    problems,
  };
}
