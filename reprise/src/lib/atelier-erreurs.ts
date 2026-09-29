import type { DictKey } from "@/i18n/dictionaries";

/**
 * Les fonctions serveur ne renvoient jamais de phrase : elles renvoient un code.
 * La phrase se choisit ici, dans la langue de l'écran.
 */
export function cleErreurAtelier(error: unknown): DictKey {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("QR_TAKEN")) return "atelier.livre.err.qrTaken";
  if (message.includes("SLUG_TAKEN")) return "atelier.livre.err.slugTaken";
  if (message.includes("PAGE_NO_TAKEN")) return "atelier.livre.page.err.pageNoTaken";
  if (message.includes("AUDIO_BAD_FORMAT")) return "atelier.livre.audio.err.format";
  if (message.includes("AUDIO_TOO_BIG")) return "atelier.livre.audio.err.tooBig";
  if (message.includes("AUDIO_")) return "atelier.livre.audio.err.failed";
  if (message.includes("PASTE_INVALID")) return "atelier.livre.coller.err.invalid";
  if (message.includes("TITLE_REQUIRED_FR")) return "atelier.edition.err.titleFr";
  if (message.includes("TITLE_REQUIRED_EN")) return "atelier.edition.err.titleEn";
  if (message.includes("EDITION_ONE_REQUIRED")) return "atelier.edition.err.oneRequired";
  if (message.includes("EDITION_BLOCKED")) return "atelier.edition.err.blocked";
  if (message.includes("GLOSSARY_BAD_FORMAT")) return "atelier.edition.glossary.err.format";
  if (message.includes("GLOSSARY_TOO_BIG")) return "atelier.edition.glossary.err.tooBig";
  if (message.includes("GLOSSARY_")) return "atelier.edition.glossary.err.failed";
  if (message.includes("PAGE_NOT_FOUND")) return "atelier.livre.page.notFound";
  return "atelier.livre.err.save";
}
