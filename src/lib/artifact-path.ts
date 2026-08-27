/**
 * LOT C — CONVENTION DE CHEMIN DES ARTEFACTS.
 *
 *   books/{book_id}/{step_code}/{lang}/{type}/v{version}/{fichier}
 *
 * Versionnée, jamais réutilisée : une nouvelle version écrit un nouveau
 * chemin. Module pur (aucun secret, aucun client) : il sert aussi à
 * l'affichage côté navigateur.
 */

export const ARTIFACT_BUCKET = "artifacts";

export const ARTIFACT_TYPES = [
  "plan",
  "recit_txt",
  "master_he",
  "ktiv_male",
  "delta_lexical",
  "glossaire",
  "quiz",
  "pdf_interieur",
  "pdf_couverture",
  "paquet_kdp",
  "audio",
  "autre",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/** Nom de fichier assaini : pas d'espace, pas de séparateur de chemin. */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "fichier";
}

export function artifactPath(input: {
  bookId: string;
  stepCode: string;
  lang: string;
  type: string;
  version: number;
  fileName: string;
}): string {
  return [
    "books",
    input.bookId,
    input.stepCode,
    input.lang,
    input.type,
    `v${input.version}`,
    safeFileName(input.fileName),
  ].join("/");
}

/** Le nom lisible d'un artefact, sans exposer tout le chemin. */
export function artifactFileName(storagePath: string): string {
  const parts = storagePath.split("/");
  return parts[parts.length - 1] ?? storagePath;
}
