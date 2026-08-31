/**
 * LES DEUX MODÈLES DE L'ATELIER — un seul endroit à modifier.
 *
 * Les identifiants sont ÉPINGLÉS : jamais « le modèle par défaut de la
 * passerelle », qui change avec le temps sans qu'on le sache. Changer de
 * version, c'est changer ces deux constantes, et rien d'autre.
 *
 * Module pur : aucune clé, aucun client. Il sert aussi à l'écran (menu
 * déroulant, libellés, infobulles).
 */

export const MODELE_GEMINI = "google/gemini-3.7-flash";
export const MODELE_CLAUDE = "claude-sonnet-5";

export const MODELES = [
  {
    id: MODELE_GEMINI,
    label: "Gemini 3.7 Flash (Lovable AI)",
    fournisseur: "Passerelle IA de Lovable",
  },
  {
    id: MODELE_CLAUDE,
    label: "Claude Sonnet (clé Anthropic)",
    fournisseur: "API Anthropic",
  },
] as const;

export type ModeleId = (typeof MODELES)[number]["id"];

export const MODELE_IDS: string[] = MODELES.map((m) => m.id);

export function libelleModele(id: string | null): string {
  return MODELES.find((m) => m.id === id)?.label ?? (id ?? "aucun");
}

/* ------------------------------------------------------------------ */
/* ÉTAPES ET RÔLES — listes fermées, extensibles ici seulement.        */
/* ------------------------------------------------------------------ */

export const ETAPES = [
  { code: "plan", label: "Plan" },
  { code: "recit", label: "Récit" },
  { code: "vocabulaire", label: "Vocabulaire" },
  { code: "hebreu", label: "Hébreu" },
  { code: "assemblage", label: "Assemblage" },
] as const;

export const ROLES = [
  { code: "methode", label: "Méthode" },
  { code: "methode_controle", label: "Méthode (contrôle)" },
  { code: "regles_controle", label: "Règles de contrôle" },
  { code: "redaction_corrective", label: "Rédaction corrective" },
  { code: "redaction_initiale", label: "Rédaction initiale" },
] as const;

export const ETAPE_CODES: string[] = ETAPES.map((e) => e.code);
export const ROLE_CODES: string[] = ROLES.map((r) => r.code);

export function libelleEtape(code: string): string {
  return ETAPES.find((e) => e.code === code)?.label ?? code;
}

export function libelleRole(code: string): string {
  return ROLES.find((r) => r.code === code)?.label ?? code;
}

/** Le contenu d'un prompt encore vide : il ne doit jamais partir au modèle. */
export const PROMPT_A_REMPLIR = "(à remplir)";

export function promptVide(contenu: string | null | undefined): boolean {
  const c = (contenu ?? "").trim();
  return c.length === 0 || c === PROMPT_A_REMPLIR;
}

/* ------------------------------------------------------------------ */
/* LES TROIS MODES DU CONTRÔLE DU PLAN                                 */
/* ------------------------------------------------------------------ */

export const MODES_CONTROLE = [
  { code: "A", label: "Mode A — Contrôle seul", desc: "rapport seul, correction à la main" },
  { code: "B", label: "Mode B — Contrôle + correction", desc: "rapport + correction automatique" },
  { code: "C", label: "Mode C — Boucle", desc: "boucle contrôle-correction (un cycle pour l'instant)" },
] as const;

export type ModeControle = (typeof MODES_CONTROLE)[number]["code"];
