/** Adresse publique d'un fichier du stockage « site » (couvertures). Aucune clé nécessaire. */
export function getSiteUrl(path: string): string {
  const base = process.env["SUPABASE_URL"] ?? "";
  return `${base}/storage/v1/object/public/site/${path.split("/").map(encodeURIComponent).join("/")}`;
}
