/**
 * Textes de l'admin. L'admin est l'outil de Ben : il est en français seulement
 * (cahier phase 2), donc hors des dictionnaires publics FR/EN.
 */
export const ERREURS: Record<string, string> = {
  SLUG_EMPTY: "Le slug est obligatoire.",
  SLUG_FORMAT: "Le slug ne peut contenir que des minuscules, des chiffres et des tirets (ex. : eli-cohen).",
  SLUG_RESERVED: "Ce slug est un mot réservé du site (une adresse existe déjà sous ce nom). Choisissez-en un autre.",
  SLUG_TAKEN: "Ce slug est déjà utilisé par un livre ou une collection.",
  SLUG_LOCKED: "Adresse imprimée dans un QR : elle ne peut plus changer.",
  BOOK_NOT_FOUND: "Ce livre n'existe pas.",
  EDITION_EXISTS: "Cette édition existe déjà.",
  EDITION_NOT_FOUND: "Cette édition n'existe pas.",
  EDITION_PUBLISHED: "Une édition publiée ne se supprime pas.",
  CONFIRM_MISMATCH: "Le slug saisi ne correspond pas.",
  PASTE_INVALID: "L'analyse a trouvé des erreurs : rien n'a été écrit.",
  PAGE_NO_TAKEN: "Un de ces numéros de page existe déjà.",
  PAGE_NOT_FOUND: "Cette page n'existe pas.",
  AUDIO_BAD_FORMAT: "Seuls les fichiers .mp3 et .m4a sont acceptés.",
  AUDIO_TOO_BIG: "Fichier trop lourd (50 Mo au plus).",
  AUDIO_: "L'envoi de l'audio a échoué.",
  Forbidden: "Accès refusé : ce compte n'a pas le rôle éditeur.",
  Unauthorized: "Session expirée : reconnectez-vous.",
};

export function messageErreur(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e ?? "");
  for (const [code, phrase] of Object.entries(ERREURS)) if (m.includes(code)) return phrase;
  return "L'enregistrement a échoué. Réessayez.";
}

export const VERDICTS: Record<string, string> = {
  ok: "Nouvelle page",
  remplacement: "Remplacement",
  manqueDroite: "Absente de la zone sans nekoudot",
  manqueGauche: "Absente de la zone vocalisée",
  nombres: "Nombres de paragraphes différents",
  double: "Doublon",
  existe: "Existe déjà (cocher « Remplacer »)",
};
