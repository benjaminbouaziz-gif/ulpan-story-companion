/** Types de blocs et types permis par écran (partagé écran / serveur). */
export const BLOCK_KINDS = ["titre", "texte", "etapes", "faq", "citation", "chiffres", "image"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const PAGE_KEYS = [
  "accueil_ouverture", "accueil_methode", "accueil_livres", "accueil_collections", "accueil_lecteur",
  "methode", "contact", "mentions", "confidentialite", "pied",
] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export const KINDS_BY_PAGE: Record<PageKey, readonly BlockKind[]> = {
  accueil_ouverture: ["titre", "texte"],
  accueil_methode: ["titre", "texte"],
  accueil_livres: ["titre", "texte"],
  accueil_collections: ["titre", "texte"],
  accueil_lecteur: ["titre", "texte"],
  pied: ["texte"],
  methode: BLOCK_KINDS,
  contact: ["titre", "texte"],
  mentions: ["titre", "texte"],
  confidentialite: ["titre", "texte"],
};
export const COLLECTION_KINDS: readonly BlockKind[] = ["texte", "image"];

export const KIND_LABELS: Record<BlockKind, string> = {
  titre: "Titre",
  texte: "Texte",
  etapes: "Étapes",
  faq: "Questions fréquentes",
  citation: "Citation",
  chiffres: "Chiffres",
  image: "Image",
};

export type Etape = { numero: string; titre: string; texte: string };
export type Faq = { question: string; reponse: string };
export type Chiffre = { valeur: string; libelle: string };
export type BlockItems = Etape[] | Faq[] | Chiffre[] | [];

export type Block = {
  id: string;
  kind: BlockKind;
  sort_order: number;
  title: string | null;
  body: string | null;
  items: BlockItems;
  image_path: string | null;
  is_visible: boolean;
};
