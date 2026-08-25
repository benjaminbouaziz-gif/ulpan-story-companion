import type { Lang } from "@/i18n/dictionaries";

/**
 * L'extrait démonstratif : une suite de paragraphes du livre, dont le soutien
 * décroît en descendant. Aucune mécanique d'interface : c'est une page imprimée.
 */

export type ExcerptParagraph = {
  id: string;
  sort_order: number;
  stage_no: number;
  stage_label_fr: string | null;
  stage_label_en: string | null;
  he: string;
  has_nikud: boolean;
  support_fr: string | null;
  support_en: string | null;
  audio_path: string | null;
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

/** Retire les nekoudot sans toucher aux lettres : sert aux étapes sans voyelles. */
export function stripNikud(text: string): string {
  return text.replace(NIKUD, "");
}

export function hasNikudSigns(text: string): boolean {
  return NIKUD.test(text);
}

export function paragraphSupport(p: ExcerptParagraph, lang: Lang): string | null {
  const value = lang === "en" ? p.support_en : p.support_fr;
  return value && value.trim().length > 0 ? value : null;
}

export function stageLabel(p: ExcerptParagraph, lang: Lang): string | null {
  return (lang === "en" ? p.stage_label_en : p.stage_label_fr) ?? null;
}

export function glossarySense(item: GlossaryItem, lang: Lang): string | null {
  return (lang === "en" ? item.sense_en : item.sense_fr) ?? null;
}
