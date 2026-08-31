/**
 * LES DEUX MODÈLES OUVERTS DANS L'ATELIER.
 *
 * Module partagé client et serveur : AUCUNE CLÉ ici, seulement des
 * identifiants. Le fournisseur se déduit du préfixe de l'identifiant, donc
 * ces chaînes ne s'abrègent jamais, ne se normalisent jamais, ne se
 * corrigent jamais : « gemini-… » sans « google/ » partirait chez un autre
 * fournisseur, sur une autre clé.
 */

export type ModeleAtelier = {
  id: string;
  libelle: string;
  rechercheEnLigne: boolean;
};

export const MODELES_ATELIER: ModeleAtelier[] = [
  {
    id: "google/gemini-2.5-flash",
    libelle: "Gemini 2.5 Flash — passerelle Lovable",
    rechercheEnLigne: false,
  },
  {
    id: "claude-sonnet-4-6",
    libelle: "Claude Sonnet 4.6 — clé Anthropic de l'atelier",
    rechercheEnLigne: true,
  },
];

export function modeleConnu(id: string): ModeleAtelier | null {
  return MODELES_ATELIER.find((m) => m.id === id) ?? null;
}
