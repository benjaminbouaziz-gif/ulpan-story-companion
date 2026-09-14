/**
 * BRIQUE 7 — COLLER UN LIVRE ENTIER.
 *
 * Découpage d'un fichier de travail en pages, à partir des marqueurs
 * « פרק <n> · עמוד <n> ». Ce module est volontairement pur : l'écran s'en sert
 * pour l'analyse, la fonction serveur s'en resert pour vérifier elle-même ce
 * qu'elle écrit. Rien n'est déduit d'un texte à l'autre : l'hébreu vocalisé et
 * l'hébreu sans nekoudot sont deux saisies distinctes.
 */

/** Une ligne est un marqueur dès qu'elle porte פרק <nombre> puis עמוד <nombre>. */
const MARQUEUR = /פרק\s*(\d+)[^\d]*?עמוד\s*(\d+)/;

/** Une ligne faite uniquement de tirets (ou de traits) n'est pas un paragraphe. */
const SEPARATEUR = /^[\s\-—–_=*#·]+$/;

export type ColleePage = {
  pageNo: number;
  chapterNo: number;
  paragraphs: string[];
};

export type ColleeParse = {
  pages: ColleePage[];
  /** Numéros de page vus deux fois ou plus dans le texte collé. */
  duplicates: number[];
};

export function parseColle(text: string): ColleeParse {
  const pages: ColleePage[] = [];
  let courante: ColleePage | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const m = MARQUEUR.exec(raw);
    if (m) {
      courante = { chapterNo: Number(m[1]), pageNo: Number(m[2]), paragraphs: [] };
      pages.push(courante);
      continue;
    }
    // Avant le premier marqueur : en-tête du fichier, ignoré.
    if (!courante) continue;
    const ligne = raw.trim();
    if (ligne.length === 0 || SEPARATEUR.test(ligne)) continue;
    courante.paragraphs.push(ligne);
  }

  const vus = new Map<number, number>();
  for (const p of pages) vus.set(p.pageNo, (vus.get(p.pageNo) ?? 0) + 1);
  const duplicates = [...vus.entries()].filter(([, n]) => n > 1).map(([no]) => no);

  return { pages, duplicates };
}

export type VerdictColle =
  | "ok"
  | "remplacement"
  | "manqueDroite"
  | "manqueGauche"
  | "nombres"
  | "double"
  | "existe";

export type LigneColle = {
  pageNo: number;
  chapterNo: number | null;
  gauche: number | null;
  droite: number | null;
  verdict: VerdictColle;
};

export type AnalyseColle = {
  lignes: LigneColle[];
  ok: boolean;
};

/**
 * Appariement strict : aucune page n'est devinée, complétée, tronquée, ni
 * appariée au plus proche. Un seul écart et l'écriture reste interdite.
 */
export function analyserColle(
  nikud: string,
  plain: string,
  pagesExistantes: number[],
  remplacer: boolean,
): AnalyseColle {
  const g = parseColle(nikud);
  const d = parseColle(plain);

  const parNo = (p: ColleeParse) => new Map(p.pages.map((x) => [x.pageNo, x]));
  const gMap = parNo(g);
  const dMap = parNo(d);
  const doubles = new Set([...g.duplicates, ...d.duplicates]);
  const dejaLa = new Set(pagesExistantes);

  const numeros = [...new Set([...gMap.keys(), ...dMap.keys()])].sort((a, b) => a - b);

  const lignes = numeros.map<LigneColle>((no) => {
    const pg = gMap.get(no) ?? null;
    const pd = dMap.get(no) ?? null;
    const base = {
      pageNo: no,
      chapterNo: pg?.chapterNo ?? pd?.chapterNo ?? null,
      gauche: pg ? pg.paragraphs.length : null,
      droite: pd ? pd.paragraphs.length : null,
    };
    if (doubles.has(no)) return { ...base, verdict: "double" };
    if (!pd) return { ...base, verdict: "manqueDroite" };
    if (!pg) return { ...base, verdict: "manqueGauche" };
    if (pg.paragraphs.length !== pd.paragraphs.length) return { ...base, verdict: "nombres" };
    if (pg.paragraphs.length === 0) return { ...base, verdict: "nombres" };
    if (dejaLa.has(no)) {
      return { ...base, verdict: remplacer ? "remplacement" : "existe" };
    }
    return { ...base, verdict: "ok" };
  });

  const ok =
    lignes.length > 0 && lignes.every((l) => l.verdict === "ok" || l.verdict === "remplacement");
  return { lignes, ok };
}

/** Une réplique de dialogue s'annonce par un tiret cadratin ou un guillemet hébreu. */
export function natureDuBloc(ligneVocalisee: string): "narrative" | "dialogue" {
  const t = ligneVocalisee.trimStart();
  return t.startsWith("—") || t.startsWith("״") ? "dialogue" : "narrative";
}
