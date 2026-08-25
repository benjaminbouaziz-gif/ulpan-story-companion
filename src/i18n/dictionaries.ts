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
  "home.method.title": "La méthode, en deux pages",
  "home.method.left": "Page de gauche : l'hébreu vocalisé.",
  "home.method.right": "Page de droite : un soutien qui se retire au fil du livre.",
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
  "mirror.support": "Soutien",
  "mirror.empty": "Ce passage n'est pas encore aligné.",
  "mirror.glossary": "Glossaire",
  "mirror.noGloss": "Pas encore de définition pour ce mot.",
  "mirror.tapForGlossary": "Touchez un mot pour ouvrir le glossaire.",
  "mirror.title": "Le miroir",
  "mirror.tryIt": "Essayez : bougez le curseur, touchez un mot.",
  "mirror.longPress": "Appui long sur un mot : le glossaire s'ouvre.",
  "admin.segments": "Extraits alignés",
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
  "home.method.title": "The method, in two pages",
  "home.method.left": "Left page: Hebrew with nikud.",
  "home.method.right": "Right page: support that withdraws as the book goes on.",
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
  "mirror.support": "Support",
  "mirror.empty": "This passage is not aligned yet.",
  "mirror.glossary": "Glossary",
  "mirror.noGloss": "No definition for this word yet.",
  "mirror.tapForGlossary": "Tap a word to open the glossary.",
  "mirror.title": "The mirror",
  "mirror.tryIt": "Try it: move the slider, tap a word.",
  "mirror.longPress": "Long-press a word: the glossary opens.",
  "admin.segments": "Aligned excerpts",
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
