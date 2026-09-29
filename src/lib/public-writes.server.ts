/**
 * SEULE porte d'écriture pour les visiteurs et les lecteurs (événements,
 * demandes d'accès, lecteurs, accès, réponses aux quiz, désinscription,
 * suppression de compte). Chaque fonction exportée contrôle elle-même ses
 * entrées et les droits du lecteur avant d'utiliser le client de service.
 *
 * Le client de service s'obtient par import DYNAMIQUE, à l'intérieur des
 * fonctions : la clé n'entre jamais dans le graphe client.
 */
import { createHmac } from "node:crypto";

async function serviceClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** HMAC-SHA256 avec le secret IP_HASH_SECRET. Sert aux IP et aux e-mails utilisés comme clés de limitation. */
export function hashValue(value: string): string {
  const secret = process.env["IP_HASH_SECRET"];
  if (!secret) throw new Error("Secret IP_HASH_SECRET manquant : le créer dans les secrets du projet.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

/**
 * Compteur par fenêtre fixe dans rate_limits. `key` est toujours déjà hachée.
 * Renvoie false si la limite est atteinte.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const admin = await serviceClient();
  const ms = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / ms) * ms).toISOString();
  const { data: row } = await admin
    .from("rate_limits")
    .select("count")
    .eq("key", key)
    .eq("window_start", windowStart)
    .maybeSingle();
  const count = row?.count ?? 0;
  if (count >= limit) return false;
  const { error } = await admin
    .from("rate_limits")
    .upsert({ key, window_start: windowStart, count: count + 1 }, { onConflict: "key,window_start" });
  if (error) throw new Error("Limitation indisponible");
  return true;
}

/* ---- Registre des tentatives de connexion à l'admin (admin_login_attempts) ---- */

/** Nombre d'échecs enregistrés depuis `sinceIso` pour une empreinte donnée. */
export async function countLoginFailures(column: "email_hash" | "ip_hash", value: string, sinceIso: string): Promise<number> {
  const admin = await serviceClient();
  const { count, error } = await admin
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", sinceIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Écrit un échec réel (jamais sur déclaration du client). Empreintes seulement. */
export async function recordLoginFailure(emailHash: string, ipHash: string | null): Promise<void> {
  const admin = await serviceClient();
  const { error } = await admin.from("admin_login_attempts").insert({ email_hash: emailHash, ip_hash: ipHash });
  if (error) throw new Error(error.message);
}

/* ---- Vitrine : clic sur « Acheter sur Amazon » ---- */

/**
 * Enregistre un événement amazon_click pour une édition visible.
 * Limité à 30 par minute et par empreinte d'IP ; aucune donnée personnelle
 * n'est écrite (ni IP, ni empreinte : seulement le type et l'édition).
 */
export async function recordAmazonClick(editionId: string, ip: string): Promise<boolean> {
  const admin = await serviceClient();
  const { data: visible, error: e1 } = await admin.rpc("edition_visible", { _edition_id: editionId });
  if (e1 || !visible) return false;
  if (!(await checkRateLimit("amazon:" + hashValue(ip), 30, 60))) return false;
  const { error } = await admin.from("events").insert({ type: "amazon_click", edition_id: editionId });
  if (error) throw new Error(error.message);
  return true;
}
