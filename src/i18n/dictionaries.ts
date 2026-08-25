export type Lang = "fr" | "en";

export const LANGS: Lang[] = ["fr", "en"];

const fr = {
  "site.name": "Ulpan Story",
  "site.motto": "Vous n'allez pas étudier l'hébreu. Vous allez le lire.",
  "site.tagline": "Des livres pour apprendre l'hébreu en lisant de vraies histoires.",
  "site.support": "Ulpan Story ne remplace pas votre oulpan. C'est son soutien.",

  "nav.home": "Accueil",
  "nav.method": "La méthode",
  "nav.collections": "Les collections",
  "nav.companion": "Espace lecteur",
  "nav.menu": "Menu",
  "nav.close": "Fermer",

  "home.lede":
    "Vous allez à l'oulpan deux soirs par semaine. Vous apprenez des règles, vous faites des exercices — et entre deux cours, vous n'avez rien à lire à votre niveau. C'est ce trou-là que nous comblons.",
  "home.method.title": "La méthode",
  "home.method.link": "Lire la méthode",
  "home.collections.title": "Les collections",
  "home.collections.link": "Voir toutes les collections",
  "home.books.title": "Disponible aujourd'hui",
  "home.qr.title": "Derrière le QR code",
  "home.qr.body":
    "Chaque livre imprimé porte un QR code. Il ouvre le compagnon du livre : glossaire, quiz, lecture audio et conversation en hébreu. Offert avec le livre.",

  "collections.empty": "Aucune collection publiée pour l'instant.",
  "collections.volumes": "Tomes",
  "collections.forWhom": "À qui elle s'adresse",
  "books.empty": "Aucun tome publié dans cette collection pour l'instant.",
  "books.volume": "Tome",
  "books.excerpt": "Extrait",
  "books.translation": "Soutien",
  "books.notFound": "Ce livre n'existe pas ou n'est pas encore publié.",
  "books.learn": "Ce que vous y apprenez",
  "books.chapters": "chapitres",
  "books.words": "mots uniques",
  "books.pages": "pages",

  "reading.settings": "Lecture",
  "reading.textSize": "Taille du texte",
  "reading.size.normal": "Normal",
  "reading.size.grand": "Grand",
  "reading.size.tresGrand": "Très grand",
  "reading.theme": "Fond",
  "reading.theme.ivory": "Ivoire",
  "reading.theme.night": "Nuit",
  "reading.sample": "אֵלִי כֹּהֵן נוֹלַד בְּמִצְרַיִם",

  "footer.lang": "Langue",
  "footer.legal": "Mentions légales",
  "footer.privacy": "Confidentialité",
  "footer.contact": "Contact",
  "footer.rights": "Ulpan Story — maison d'édition indépendante.",

  "empty.page": "Cette page n'a pas encore de contenu publié.",
  "soon": "Cet écran arrive dans une prochaine étape.",
  "back.home": "Retour à l'accueil",
  "excerpt.empty": "L'extrait de ce livre n'est pas encore en ligne.",
  "excerpt.before": "Lisez ce passage jusqu'en bas.",
  "excerpt.after1":
    "Les six derniers mots que vous venez de lire étaient en hébreu, sans voyelles, sans traduction.",
  "excerpt.after2": "C'est la dernière page du livre.",
  "excerpt.glossary": "Glossaire du passage",
  "excerpt.glossaryFull":
    "La liste complète du chapitre est dans le compagnon, avec sa version imprimable.",
  "spread.caption": "A5 × 2 · proportions réelles · hébreu à gauche, soutien à droite",
  "spread.watch": "Regardez la page de droite se vider, ligne après ligne.",
  "spread.read": "Lire cette page en grand",
  "spread.chapter": "Chapitre trois",
  "admin.excerpt": "Extrait démonstratif",
  "admin.forbidden": "Accès réservé.",

} as const;

export type DictKey = keyof typeof fr;

const en: Record<DictKey, string> = {
  "site.name": "Ulpan Story",
  "site.motto": "You are not going to study Hebrew. You are going to read it.",
  "site.tagline": "Books for learning Hebrew by reading real stories.",
  "site.support": "Ulpan Story does not replace your ulpan. It supports it.",

  "nav.home": "Home",
  "nav.method": "The method",
  "nav.collections": "Collections",
  "nav.companion": "Reader area",
  "nav.menu": "Menu",
  "nav.close": "Close",

  "home.lede":
    "You go to the ulpan two evenings a week. You learn rules, you do exercises — and between classes there is nothing to read at your level. That is the gap we fill.",
  "home.method.title": "The method",
  "home.method.link": "Read the method",
  "home.collections.title": "Collections",
  "home.collections.link": "See all collections",
  "home.books.title": "Available today",
  "home.qr.title": "Behind the QR code",
  "home.qr.body":
    "Every printed book carries a QR code. It opens the book's companion: glossary, quizzes, audio reading and Hebrew conversation. Included with the book.",

  "collections.empty": "No collection published yet.",
  "collections.volumes": "Volumes",
  "collections.forWhom": "Who it is for",
  "books.empty": "No volume published in this collection yet.",
  "books.volume": "Volume",
  "books.excerpt": "Excerpt",
  "books.translation": "Support",
  "books.notFound": "This book does not exist or is not published yet.",
  "books.learn": "What you learn",
  "books.chapters": "chapters",
  "books.words": "unique words",
  "books.pages": "pages",

  "reading.settings": "Reading",
  "reading.textSize": "Text size",
  "reading.size.normal": "Normal",
  "reading.size.grand": "Large",
  "reading.size.tresGrand": "Extra large",
  "reading.theme": "Background",
  "reading.theme.ivory": "Ivory",
  "reading.theme.night": "Night",
  "reading.sample": "אֵלִי כֹּהֵן נוֹלַד בְּמִצְרַיִם",

  "footer.lang": "Language",
  "footer.legal": "Legal notice",
  "footer.privacy": "Privacy",
  "footer.contact": "Contact",
  "footer.rights": "Ulpan Story — independent publishing house.",

  "empty.page": "This page has no published content yet.",
  "soon": "This screen arrives in a later step.",
  "back.home": "Back to home",
  "excerpt.empty": "This book's excerpt is not online yet.",
  "excerpt.before": "Read this passage to the bottom.",
  "excerpt.after1":
    "The last six words you just read were Hebrew, without vowels, without translation.",
  "excerpt.after2": "That is the last page of the book.",
  "excerpt.glossary": "Glossary of this passage",
  "excerpt.glossaryFull":
    "The full chapter list is in the companion, with a printable version.",
  "spread.caption": "A5 × 2 · real proportions · Hebrew on the left, support on the right",
  "spread.watch": "Watch the right-hand page empty out, line after line.",
  "spread.read": "Read this page at full size",
  "spread.chapter": "Chapter three",
  "admin.excerpt": "Demonstration excerpt",
  "admin.forbidden": "Restricted access.",

};

export const dictionaries: Record<Lang, Record<DictKey, string>> = { fr, en };

export function langFromHost(host: string | undefined | null): Lang {
  if (!host) return "fr";
  const h = host.toLowerCase();
  if (h.includes("ulpanstory.com")) return "en";
  if (h.includes("oulpanstory.fr")) return "fr";
  return "fr";
}
