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
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|embedly|preview|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|httpclient|go-http|axios|node-fetch|whatsapp|telegram|discord|linkedin|twitter/i;

/** Robot : pas de user-agent, ou user-agent d'un robot connu. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  return !ua || !ua.trim() || BOT_UA.test(ua);
}

/**
 * Clic Amazon. Ignoré pour les robots et si le même visiteur anonyme
 * (cookie de session aléatoire) a déjà cliqué ce livre depuis moins de 30 min.
 */
export async function recordAmazonClick(editionId: string, ip: string, visitorId: string, userAgent: string | null): Promise<boolean> {
  if (isBotUserAgent(userAgent)) return false;
  const admin = await serviceClient();
  const { data: visible, error: e1 } = await admin.rpc("edition_visible", { _edition_id: editionId });
  if (e1 || !visible) return false;
  if (!(await checkRateLimit("amazon:" + hashValue(ip), 30, 60))) return false;
  const vKey = "amazonvis:" + hashValue(visitorId + ":" + editionId);
  // Une seule ligne par visiteur+livre ; count = minute du dernier clic compté.
  // Mise à jour conditionnelle (compare-and-swap) : sûre face aux clics simultanés.
  const nowMin = Math.floor(Date.now() / 60000);
  const { data: cur } = await admin.from("rate_limits").select("window_start, count").eq("key", vKey).maybeSingle();
  if (!cur) {
    const { error: e2 } = await admin.from("rate_limits").insert({ key: vKey, window_start: new Date().toISOString(), count: nowMin });
    if (e2) return false; // un autre clic simultané a gagné
  } else {
    if (nowMin - cur.count < 30) return false;
    const { data: upd } = await admin.from("rate_limits").update({ count: nowMin })
      .eq("key", vKey).eq("window_start", cur.window_start).eq("count", cur.count).select("key");
    if (!upd || !upd.length) return false;
  }
  const { error } = await admin.from("events").insert({ type: "amazon_click", edition_id: editionId });
  if (error) throw new Error(error.message);
  return true;
}
