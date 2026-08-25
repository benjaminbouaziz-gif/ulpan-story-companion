import type { Lang } from "@/i18n/dictionaries";

/**
 * Les pages du livre, relevées sur le PDF de lecture du tome 1.
 * Page de gauche : l'hébreu. Page de droite : le soutien.
 *
 * Aucune fonction de dévocalisation n'existe ici, et il ne doit jamais y en
 * avoir : l'hébreu non vocalisé s'écrit en ktiv malé (שתיים et non שתים).
 * `he_plain` est un champ saisi.
 */

export type PageSupportKind = "translation" | "cloze" | "keys" | "nikud";

export type BlockKind = "narrative" | "dialogue";

export type PageBlock = {
  id: string;
  sort_order: number;
  block_kind: BlockKind;
  he_nikud: string | null;
  he_plain: string | null;
  support_fr: string | null;
  support_en: string | null;
};

export type PageKey = {
  id: string;
  sort_order: number;
  gloss_no: number | null;
  he_nikud: string;
  translit: string | null;
  sense_fr: string | null;
  sense_en: string | null;
};

export type BookPage = {
  id: string;
  page_no: number;
  chapter_no: number | null;
  support_kind: PageSupportKind;
  chapter_title_he: string | null;
  chapter_title_fr: string | null;
  chapter_title_en: string | null;
  running_head_fr: string | null;
  running_head_en: string | null;
  folio: number | null;
  is_published: boolean;
  validated_at: string | null;
  blocks: PageBlock[];
  keys: PageKey[];
};

export type GlossaryWord = {
  id: string;
  gloss_no: number | null;
  he_nikud: string;
  translit: string | null;
  sense_fr: string | null;
  sense_en: string | null;
  first_page: number | null;
};

/** Le soutien affiché : français ou anglais selon la langue du site. */
export function blockSupport(block: PageBlock, lang: Lang): string | null {
  const value = lang === "en" ? block.support_en : block.support_fr;
  return value && value.trim().length > 0 ? value : null;
}

export function pageKeySense(key: PageKey, lang: Lang): string | null {
  return (lang === "en" ? key.sense_en : key.sense_fr) ?? null;
}

export function glossarySense(word: GlossaryWord, lang: Lang): string | null {
  return (lang === "en" ? word.sense_en : word.sense_fr) ?? null;
}

/**
 * Les trous de l'étape 2 : `[[Michtara|102]]` se rend « Michtara (102) ».
 * Le mot et son numéro sont un seul objet, jamais coupé en fin de ligne.
 */
export type SupportPiece = { text: string } | { translit: string; gloss_no: number };

export function parseSupport(text: string): SupportPiece[] {
  const out: SupportPiece[] = [];
  const re = /\[\[([^\]|]+)\|(\d+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ translit: m[1]!.trim(), gloss_no: Number(m[2]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function clozeNumbers(text: string): number[] {
  return parseSupport(text)
    .filter((p): p is { translit: string; gloss_no: number } => "gloss_no" in p)
    .map((p) => p.gloss_no);
}

/** Récit ou réplique : la ponctuation d'ouverture le dit, des deux côtés. */
const OPENERS_LATIN = ['"', "«", "—", "–", "“", "‘", "'"];
const OPENERS_HEBREW = ['"', "״", "—", "–", "”"];

export function detectBlockKind(text: string, side: "he" | "latin"): BlockKind {
  const first = text.trim().charAt(0);
  const openers = side === "he" ? OPENERS_HEBREW : OPENERS_LATIN;
  return openers.includes(first) ? "dialogue" : "narrative";
}

/** Les deux pages se répondent bloc à bloc — sauf à l'étape des clés. */
export function usesSharedGrid(kind: PageSupportKind): boolean {
  return kind !== "keys";
}

/** La page de gauche, selon l'étape : vocalisé, ou ktiv malé à l'étape 4. */
export function leftHebrew(block: PageBlock, kind: PageSupportKind): string | null {
  const value = kind === "nikud" ? block.he_plain : block.he_nikud;
  return value && value.trim().length > 0 ? value : null;
}

const nonEmpty = (v: string | null | undefined) => Boolean(v && v.trim().length > 0);

/** Mesures de la page imprimée, en millimètres. Rien ici n'est décoratif. */
export const MM = {
  pageW: 148,
  pageH: 210,
  marginTop: 18,
  marginSide: 16,
  marginBottom: 14,
  fold: 0.3,
  runheadSize: 2.3,
  runheadGap: 7,
  chapterLatin: 5.4,
  chapterHebrew: 5.8,
  chapterGap: 6,
  hebrewSize: 3.8,
  hebrewLine: 1.66,
  supportSize: 2.85,
  supportLine: 1.56,
  supportHeSize: 3.5,
  supportHeLine: 1.66,
  supportOffset: 1.5,
  supportHeOffset: 0.5,
  blockGap: 5,
  folioSize: 3,
  folioBottom: 9,
  keyNoSize: 2,
  keyNoW: 6,
  keyHeW: 24,
  keyHeSize: 3.5,
  keyTranslitW: 22,
  keyTranslitSize: 2.6,
  keySenseSize: 2.6,
  glossGutter: 8,
  glossHeadRule: 0.3,
  glossEntryRule: 0.12,
  glossNoW: 5.5,
  glossHeW: 17,
  glossHeSize: 3.2,
  glossTranslitW: 15,
  glossBodySize: 2.3,
  glossPerColumn: 22,
} as const;

/** Descente à appliquer pour caler la première ligne de base sur l'hébreu. */
export function supportOffsetMm(kind: PageSupportKind): number {
  return kind === "nikud" ? MM.supportHeOffset : MM.supportOffset;
}

/* ------------------------------------------------------------------ */
/* Le validateur                                                       */
/* ------------------------------------------------------------------ */

export type PageIssue = {
  page_no: number;
  block_no: number | null;
  code:
    | "block_count"
    | "block_kind"
    | "plain_count"
    | "missing_gloss"
    | "missing_key_gloss"
    | "block_count_en"
    | "block_kind_en";
  message: string;
};

/**
 * Une double page peut être fausse sans que rien ne le signale : deux blocs
 * découpés autrement, et tout l'alignement se décale d'un cran. Ce contrôle
 * tourne à l'enregistrement d'une page et avant toute publication.
 */
export function validateBookPage(page: BookPage, glossNumbers: Set<number>): PageIssue[] {
  const issues: PageIssue[] = [];
  const blocks = [...page.blocks].sort((a, b) => a.sort_order - b.sort_order);
  const kind = page.support_kind;

  const heTexts = blocks.map((b) => leftHebrew(b, kind)).filter(nonEmpty) as string[];

  if (kind !== "keys") {
    const frTexts = blocks.map((b) => b.support_fr).filter(nonEmpty) as string[];
    if (heTexts.length !== frTexts.length) {
      issues.push({
        page_no: page.page_no,
        block_no: Math.min(heTexts.length, frTexts.length) + 1,
        code: "block_count",
        message: `Page ${page.page_no} : ${heTexts.length} bloc(s) en hébreu contre ${frTexts.length} en soutien français. Le bloc ${Math.min(heTexts.length, frTexts.length) + 1} n'a pas de vis-à-vis.`,
      });
    }
    const pairs = Math.min(heTexts.length, frTexts.length);
    for (let i = 0; i < pairs; i++) {
      const he = detectBlockKind(heTexts[i]!, "he");
      const fr = detectBlockKind(frTexts[i]!, "latin");
      if (he !== fr) {
        issues.push({
          page_no: page.page_no,
          block_no: i + 1,
          code: "block_kind",
          message: `Page ${page.page_no}, bloc ${i + 1} : l'hébreu est ${he === "dialogue" ? "une réplique" : "du récit"}, le soutien est ${fr === "dialogue" ? "une réplique" : "du récit"}. Attendu : ${he === "dialogue" ? "une réplique" : "du récit"} des deux côtés.`,
        });
      }
    }

    const enTexts = blocks.map((b) => b.support_en).filter(nonEmpty) as string[];
    if (enTexts.length > 0) {
      if (enTexts.length !== heTexts.length) {
        issues.push({
          page_no: page.page_no,
          block_no: Math.min(heTexts.length, enTexts.length) + 1,
          code: "block_count_en",
          message: `Page ${page.page_no} : la version anglaise compte ${enTexts.length} bloc(s) contre ${heTexts.length} en hébreu.`,
        });
      }
      const enPairs = Math.min(heTexts.length, enTexts.length);
      for (let i = 0; i < enPairs; i++) {
        const he = detectBlockKind(heTexts[i]!, "he");
        const en = detectBlockKind(enTexts[i]!, "latin");
        if (he !== en) {
          issues.push({
            page_no: page.page_no,
            block_no: i + 1,
            code: "block_kind_en",
            message: `Page ${page.page_no}, bloc ${i + 1} : la version anglaise n'a pas la même nature que l'hébreu (attendu : ${he === "dialogue" ? "une réplique" : "du récit"}).`,
          });
        }
      }
    }
  }

  if (kind === "nikud") {
    const plain = blocks.map((b) => b.he_plain).filter(nonEmpty).length;
    const nikud = blocks.map((b) => b.he_nikud).filter(nonEmpty).length;
    if (plain !== nikud) {
      issues.push({
        page_no: page.page_no,
        block_no: Math.min(plain, nikud) + 1,
        code: "plain_count",
        message: `Page ${page.page_no} : ${plain} bloc(s) sans nekoudot contre ${nikud} vocalisé(s).`,
      });
    }
  }

  if (kind === "cloze") {
    blocks.forEach((b, i) => {
      const cited = [
        ...clozeNumbers(b.support_fr ?? ""),
        ...clozeNumbers(b.support_en ?? ""),
      ];
      for (const no of Array.from(new Set(cited))) {
        if (!glossNumbers.has(no)) {
          issues.push({
            page_no: page.page_no,
            block_no: i + 1,
            code: "missing_gloss",
            message: `Page ${page.page_no}, bloc ${i + 1} : le numéro ${no} cité dans un trou n'existe pas au glossaire du livre.`,
          });
        }
      }
    });
  }

  for (const key of page.keys) {
    if (key.gloss_no === null || !glossNumbers.has(key.gloss_no)) {
      issues.push({
        page_no: page.page_no,
        block_no: null,
        code: "missing_key_gloss",
        message: `Page ${page.page_no} : la clé « ${key.he_nikud} » renvoie au numéro ${key.gloss_no ?? "—"}, absent du glossaire du livre.`,
      });
    }
  }

  return issues;
}
