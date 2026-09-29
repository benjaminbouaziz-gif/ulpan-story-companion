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

  "quiz.chapter": "Chapitre {n}",
  "quiz.chapterDone": "Chapitre {n} terminé",
  "quiz.reviewDone": "Révision terminée",
  "quiz.allRight": "Tout juste.",
  "quiz.allWrong": "Aucune bonne réponse cette fois.",
  "quiz.rightAnswers": "bonnes réponses",
  "quiz.review": "À revoir",
  "quiz.youChose": "Vous aviez choisi : {c}",
  "quiz.redoOne": "Refaire la question ratée",
  "quiz.redoN": "Refaire les {n} questions ratées",
  "quiz.backChapters": "Retour aux chapitres",
  "quiz.close": "Fermer",
  "quiz.right": "Juste",
  "quiz.wrong": "Pas tout à fait",
  "quiz.theAnswer": "La réponse :",
  "quiz.reread": "Relire la page {n}",
  "quiz.page": "Page {n}",
  "quiz.notSaved": "Réponse non enregistrée.",
  "quiz.seeResult": "Voir le bilan",
  "quiz.next": "Question suivante",
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

  "quiz.chapter": "Chapter {n}",
  "quiz.chapterDone": "Chapter {n} complete",
  "quiz.reviewDone": "Review complete",
  "quiz.allRight": "All correct.",
  "quiz.allWrong": "No correct answers this time.",
  "quiz.rightAnswers": "correct answers",
  "quiz.review": "To review",
  "quiz.youChose": "You chose: {c}",
  "quiz.redoOne": "Retry the missed question",
  "quiz.redoN": "Retry the {n} missed questions",
  "quiz.backChapters": "Back to chapters",
  "quiz.close": "Close",
  "quiz.right": "Correct",
  "quiz.wrong": "Not quite",
  "quiz.theAnswer": "The answer:",
  "quiz.reread": "Reread page {n}",
  "quiz.page": "Page {n}",
  "quiz.notSaved": "Answer not saved.",
  "quiz.seeResult": "See results",
  "quiz.next": "Next question",
};

export const dictionaries: Record<Lang, Record<DictKey, string>> = { fr, en };

export function tr(lang: Lang, key: DictKey): string {
  return dictionaries[lang][key];
}
