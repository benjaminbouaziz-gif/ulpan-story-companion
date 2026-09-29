export type Lang = "fr" | "en";

export const LANGS: Lang[] = ["fr", "en"];

const fr = {
  "site.name": "Ulpan Story",
  "site.description": "Des livres pour apprendre l'hébreu en lisant de vraies histoires.",
  "site.comingSoon": "Contenu à venir",

  "nav.label": "Navigation principale",
  "nav.method": "Méthode",
  "nav.collections": "Collections",
  "nav.companion": "Espace lecteur",

  "page.accueil": "Accueil",
  "page.methode": "La méthode",
  "page.collections": "Les collections",
  "page.contact": "Contact",
  "page.mentions": "Mentions légales",
  "page.confidentialite": "Confidentialité",
  "page.activation": "Activation",
  "page.espace_lecteur": "Espace lecteur",
  "page.desinscription": "Désinscription",

  "footer.contact": "Contact",
  "footer.mentions": "Mentions légales",
  "footer.privacy": "Confidentialité",
  "footer.otherLang": "English",

  "notFound.title": "Page introuvable",
  "notFound.body": "Cette page n'existe pas ou n'est pas publiée.",
  "notFound.home": "Retour à l'accueil",
  "error.title": "Cette page ne s'est pas chargée",
  "error.body": "Un problème est survenu de notre côté. Réessayez ou revenez à l'accueil.",
  "error.retry": "Réessayer",
};

export type DictKey = keyof typeof fr;

const en: Record<DictKey, string> = {
  "site.name": "Ulpan Story",
  "site.description": "Books to learn Hebrew by reading real stories.",
  "site.comingSoon": "Content coming soon",

  "nav.label": "Main navigation",
  "nav.method": "Method",
  "nav.collections": "Collections",
  "nav.companion": "Reader space",

  "page.accueil": "Home",
  "page.methode": "The method",
  "page.collections": "Collections",
  "page.contact": "Contact",
  "page.mentions": "Legal notice",
  "page.confidentialite": "Privacy",
  "page.activation": "Activation",
  "page.espace_lecteur": "Reader space",
  "page.desinscription": "Unsubscribe",

  "footer.contact": "Contact",
  "footer.mentions": "Legal notice",
  "footer.privacy": "Privacy",
  "footer.otherLang": "Français",

  "notFound.title": "Page not found",
  "notFound.body": "This page doesn't exist or isn't published.",
  "notFound.home": "Back to home",
  "error.title": "This page didn't load",
  "error.body": "Something went wrong on our side. Try again or go back home.",
  "error.retry": "Try again",
};

export const dictionaries: Record<Lang, Record<DictKey, string>> = { fr, en };

export function tr(lang: Lang, key: DictKey): string {
  return dictionaries[lang][key];
}
