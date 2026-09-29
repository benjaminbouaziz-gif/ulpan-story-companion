/** Textes des mails d'accès, dans la langue de l'édition (jamais mélangés). */
export type MailLang = "fr" | "en";

export const MAIL = {
  fr: {
    subjectMagic: "Votre lien d’accès — Ulpan Story",
    subjectSignup: "Confirmez votre adresse — Ulpan Story",
    preview: "Votre lien d’accès au compagnon du livre",
    title: "Le compagnon de votre livre",
    body: "Cliquez sur le bouton pour ouvrir votre compagnon. Le lien et le code sont valables 24 heures.",
    button: "Ouvrir mon compagnon",
    orCode: "Ou saisissez ce code sur la page d’activation :",
    footer: "Si vous n’êtes pas à l’origine de cette demande, ignorez ce courrier.",
  },
  en: {
    subjectMagic: "Your access link — Ulpan Story",
    subjectSignup: "Confirm your email — Ulpan Story",
    preview: "Your access link to your book's companion",
    title: "Your book's companion",
    body: "Click the button to open your companion. The link and the code are valid for 24 hours.",
    button: "Open my companion",
    orCode: "Or enter this code on the activation page:",
    footer: "If you didn't request this, you can ignore this email.",
  },
} as const;

/** Langue d'après l'adresse de retour du lien : ulpanstory.com ou lang=en → anglais. */
export function mailLang(url: string | null | undefined): MailLang {
  if (!url) return "fr";
  let target = url;
  try {
    const u = new URL(url);
    target = u.searchParams.get("redirect_to") ?? url;
  } catch { /* adresse illisible : français */ }
  try {
    const r = new URL(target);
    const h = r.hostname.toLowerCase();
    if (h === "ulpanstory.com" || h === "www.ulpanstory.com" || r.searchParams.get("lang") === "en") return "en";
  } catch {
    if (/lang=en/.test(target)) return "en";
  }
  return "fr";
}
