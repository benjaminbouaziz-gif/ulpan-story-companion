/** Version du texte de consentement affiché sous le formulaire d'accès. */
export const CONSENT_TEXT_VERSION = "2026-09-29";

/** Adresses de retour des mails : liste FERMÉE, jamais tirée des en-têtes. */
export const PREVIEW_ORIGIN = "https://id-preview--498c8300-ccf3-4d40-ba90-80a5f9653b00.lovable.app";
export const ALLOWED_ORIGINS = {
  fr: "https://oulpanstory.fr",
  en: "https://ulpanstory.com",
  preview: PREVIEW_ORIGIN,
} as const;
