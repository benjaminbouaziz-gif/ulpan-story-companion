import type { Lang } from "@/i18n/dictionaries";

/**
 * La double page du livre : quatre paragraphes, quatre étapes.
 * L'hébreu est à gauche, le soutien à droite. Ce qui change d'une étape à
 * l'autre, c'est la nature du soutien — et, à l'étape 4, la vocalisation.
 */

export type SupportKind = "translation" | "cloze" | "vocabulary" | "nikud";

export type SpreadParagraph = {
  id: string;
  sort_order: number;
  stage_no: number;
  he: string;
  he_has_nikud: boolean;
  support_kind: SupportKind;
  support_fr: string | null;
  support_en: string | null;
  support_he: string | null;
};

export type GlossaryItem = {
  id: string;
  sort_order: number;
  lemma_he: string;
  sense_fr: string | null;
  sense_en: string | null;
};

/** Signes de vocalisation et de cantillation hébreux. */
const NIKUD = /[\u0591-\u05C7]/g;

/** Retire les nekoudot sans toucher aux lettres : sert à l'étape 4. */
export function stripNikud(text: string): string {
  return text.replace(NIKUD, "");
}

export function hasNikudSigns(text: string): boolean {
  NIKUD.lastIndex = 0;
  return NIKUD.test(text);
}

export function supportText(p: SpreadParagraph, lang: Lang): string | null {
  if (p.support_kind === "nikud") {
    return p.support_he && p.support_he.trim().length > 0 ? p.support_he : null;
  }
  const value = lang === "en" ? p.support_en : p.support_fr;
  return value && value.trim().length > 0 ? value : null;
}

export function glossarySense(item: GlossaryItem, lang: Lang): string | null {
  return (lang === "en" ? item.sense_en : item.sense_fr) ?? null;
}

/**
 * L'étape 2 marque les mots à retrouver par des doubles crochets :
 * « Il est né en [[Mitsraïm]]. » Le balisage reste dans la base.
 */
export type ClozePiece = { text: string; cloze: boolean };

export function parseCloze(text: string): ClozePiece[] {
  const pieces: ClozePiece[] = [];
  const re = /\[\[(.+?)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) pieces.push({ text: text.slice(last, m.index), cloze: false });
    pieces.push({ text: m[1]!, cloze: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), cloze: false });
  return pieces;
}

/** Mesures de la page imprimée, en millimètres. Rien ici n'est décoratif. */
export const MM = {
  pageW: 148,
  pageH: 210,
  marginTop: 18,
  marginSide: 16,
  marginBottom: 14,
  runheadSize: 2.3,
  runheadGap: 8,
  folioSize: 3,
  folioBottom: 9,
  band: 24,
  hebrewSize: 5.4,
  hebrewLine: 1.9,
  supportSize: 3.5,
  supportLine: 1.62,
  supportHeSize: 4.6,
  supportHeLine: 1.9,
  stageSize: 2.2,
  stageInset: 5,
  stageWidth: 8,
} as const;

/** Descente à appliquer pour que la première ligne de base tombe en face. */
export function baselineOffsetMm(kind: SupportKind): number {
  return kind === "nikud" ? 1.0 : 3.0;
}
