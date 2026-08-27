import type { EditorContext } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { ARTIFACT_BUCKET } from "./artifact-path";

/**
 * LOT C — STOCKAGE DES ARTEFACTS.
 *
 * Ordre d'écriture impératif : on téléverse D'ABORD, on insère ENSUITE. Le
 * checksum est calculé sur les octets réellement écrits dans le seau. Dans
 * l'ordre inverse, un incident entre les deux laisserait une ligne immuable
 * pointant vers le vide — irréparable autrement qu'en version suivante.
 *
 * Corollaire assumé : des objets orphelins peuvent subsister (téléversement
 * réussi, insertion échouée). `balayerOrphelins` les enlève passé 24 h.
 *
 * URLs signées : fabriquées à la demande, 15 minutes, jamais stockées en base,
 * jamais placées dans une redirection (elles finiraient dans les journaux).
 */

export const SIGNED_URL_TTL_SECONDS = 15 * 60;
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const ARTIFACT_READ_TIMEOUT_MS = 30 * 1000;
const MAX_TEXT_ARTIFACT_BYTES = 1024 * 1024;

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} : délai de ${timeoutMs / 1000} s dépassé.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signArtifact(ctx: EditorContext, storagePath: string): Promise<string> {
  const admin = await getAdminClient(ctx);
  const { data, error } = await admin.storage
    .from(ARTIFACT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error("Lien indisponible");
  return data.signedUrl;
}

/** Téléverse les octets ; ne touche jamais à la base. */
export async function uploadArtifactBytes(
  ctx: EditorContext,
  storagePath: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const admin = await getAdminClient(ctx);
  const { error } = await withTimeout(
    admin.storage.from(ARTIFACT_BUCKET).upload(storagePath, bytes, { contentType, upsert: false }),
    ARTIFACT_READ_TIMEOUT_MS,
    "Téléversement du livrable",
  );
  if (error) throw new Error(`Téléversement refusé : ${error.message}`);
}

/** Lit un livrable texte sans attente infinie, avec taille et UTF-8 contrôlés. */
export async function downloadArtifactText(
  ctx: EditorContext,
  storagePath: string,
): Promise<{ text: string; sizeBytes: number }> {
  const admin = await getAdminClient(ctx);
  const { data: blob, error } = await withTimeout(
    admin.storage.from(ARTIFACT_BUCKET).download(storagePath),
    ARTIFACT_READ_TIMEOUT_MS,
    "Lecture du plan précédent",
  );
  if (error || !blob) throw new Error(`Lecture du plan précédent impossible : ${error?.message ?? "fichier absent"}`);
  if (blob.size > MAX_TEXT_ARTIFACT_BYTES) {
    throw new Error(`Plan précédent trop volumineux : ${blob.size} octets (maximum ${MAX_TEXT_ARTIFACT_BYTES}).`);
  }
  const bytes = await withTimeout(
    blob.arrayBuffer(),
    ARTIFACT_READ_TIMEOUT_MS,
    "Décodage du plan précédent",
  );
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Le plan précédent n'est pas un fichier UTF-8 valide.");
  }
  return { text, sizeBytes: bytes.byteLength };
}

type StoredObject = { path: string; createdAt: number };

async function walk(
  admin: Awaited<ReturnType<typeof getAdminClient>>,
  prefix: string,
  out: StoredObject[],
  depth: number,
): Promise<void> {
  if (depth > 8) return;
  const { data } = await admin.storage.from(ARTIFACT_BUCKET).list(prefix, { limit: 1000 });
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      await walk(admin, path, out, depth + 1);
    } else {
      out.push({ path, createdAt: Date.parse(entry.created_at ?? "") || Date.now() });
    }
  }
}

/** Balayage : tout objet inconnu de `artifacts` et vieux de plus de 24 h part. */
export async function balayerOrphelins(ctx: EditorContext): Promise<{ scanned: number; removed: string[] }> {
  const admin = await getAdminClient(ctx);
  const objects: StoredObject[] = [];
  await walk(admin, "books", objects, 0);

  const { data: rows } = await admin.from("artifacts").select("storage_path");
  const known = new Set((rows ?? []).map((r) => r.storage_path));
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  const orphans = objects.filter((o) => !known.has(o.path) && o.createdAt < cutoff).map((o) => o.path);

  if (orphans.length > 0) {
    await admin.storage.from(ARTIFACT_BUCKET).remove(orphans);
  }
  return { scanned: objects.length, removed: orphans };
}
