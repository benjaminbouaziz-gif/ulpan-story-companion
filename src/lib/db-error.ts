/**
 * L'ERREUR DE LA BASE SE DIT TELLE QUELLE.
 *
 * Un message deviné (« Enregistrement refusé ») cache la cause et coûte des
 * heures. Ici, on garde le code de l'erreur, son message, ses détails et son
 * indice : de quoi nommer la contrainte violée sans deviner.
 */
export type ErreurBase = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null;

export function texteErreurBase(prefixe: string, error: ErreurBase): string {
  if (!error) return `${prefixe} — la base n'a rien renvoyé.`;
  const morceaux = [
    error.code ? `code ${error.code}` : null,
    error.message ?? null,
    error.details ?? null,
    error.hint ?? null,
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  return `${prefixe} — ${morceaux.join(" · ").slice(0, 1200)}`;
}

/** Vrai si l'erreur est une violation d'unicité portant sur cet index précis. */
export function violeIndex(error: ErreurBase, indexName: string): boolean {
  if (!error || error.code !== "23505") return false;
  const texte = `${error.message ?? ""} ${error.details ?? ""}`;
  return texte.includes(indexName);
}
