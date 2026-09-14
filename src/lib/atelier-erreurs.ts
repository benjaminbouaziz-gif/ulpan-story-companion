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
  if (message.includes("PAGE_NOT_FOUND")) return "atelier.livre.page.notFound";
  return "atelier.livre.err.save";
}
