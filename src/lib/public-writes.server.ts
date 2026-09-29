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
const VIS_WINDOW = "2000-01-01T00:00:00Z"; // fixe : une ligne unique par clé (clé primaire key+window_start)
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
  const { data: cur } = await admin.from("rate_limits").select("window_start, count").eq("key", vKey).eq("window_start", VIS_WINDOW).maybeSingle();
  if (!cur) {
    const { error: e2 } = await admin.from("rate_limits").insert({ key: vKey, window_start: VIS_WINDOW, count: nowMin });
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

/* ================================================================== */
/* Phase 6 — accès lecteur, liste d'attente, nouveautés, RGPD          */
/* ================================================================== */

type Lang = "fr" | "en";
const other = (l: Lang): Lang => (l === "fr" ? "en" : "fr");
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

export function normEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

/** Livre visible (collection visible) + ses éditions. Aucune donnée personnelle. */
async function livreEtEditions(slug: string) {
  const admin = await serviceClient();
  const { data: book } = await admin.from("books").select("id, slug, title_he, collection_id").eq("slug", slug).maybeSingle();
  if (!book?.collection_id) return null;
  const { data: col } = await admin.from("collections").select("is_visible").eq("id", book.collection_id).maybeSingle();
  if (!col?.is_visible) return null;
  const { data: eds } = await admin.from("book_editions").select("id, lang, status, title, cover_path").eq("book_id", book.id);
  return { admin, book, eds: eds ?? [] };
}

export type QrEntry =
  | { kind: "notfound" }
  | { kind: "redirect"; lang: Lang }
  | { kind: "ok"; editionId: string; title: string | null; titleHe: string | null; coverUrl: string | null; status: "preparation" | "publiee"; otherExists: boolean };

/** Entrée QR : titre, titre hébreu, couverture, statut, existence de l'autre édition. Rien d'autre. */
export async function getQrEntry(slug: string, lang: Lang): Promise<QrEntry> {
  const r = await livreEtEditions(slug);
  if (!r) return { kind: "notfound" };
  const ed = r.eds.find((e) => e.lang === lang);
  const autre = r.eds.find((e) => e.lang === other(lang));
  if (!ed) return autre?.status === "publiee" ? { kind: "redirect", lang: other(lang) } : { kind: "notfound" };
  return {
    kind: "ok",
    editionId: ed.id,
    title: ed.title,
    titleHe: r.book.title_he,
    coverUrl: ed.cover_path ? r.admin.storage.from("site").getPublicUrl(ed.cover_path).data.publicUrl : null,
    status: ed.status as "preparation" | "publiee",
    otherExists: Boolean(autre),
  };
}

async function logEvent(type: "qr_scan" | "access_requested" | "access_confirmed", editionId: string) {
  const admin = await serviceClient();
  await admin.from("events").insert({ type, edition_id: editionId });
}

/** Scan QR : un événement, sans donnée personnelle ; robots ignorés. */
export async function recordQrScan(editionId: string, userAgent: string | null): Promise<void> {
  if (isBotUserAgent(userAgent)) return;
  await logEvent("qr_scan", editionId);
}

async function limites(email: string, ip: string): Promise<boolean> {
  return (await checkRateLimit("req:" + hashValue(email), 5, 3600)) && (await checkRateLimit("req-ip:" + hashValue(ip), 20, 3600));
}

/** Adresse de retour : liste fermée, jamais les en-têtes de la requête. */
async function retourActivation(lang: Lang, production: boolean, editionId: string | null) {
  const { ALLOWED_ORIGINS } = await import("@/lib/consent");
  const q = new URLSearchParams();
  if (editionId) q.set("e", editionId);
  if (!production) q.set("lang", lang);
  const base = production ? ALLOWED_ORIGINS[lang] : ALLOWED_ORIGINS.preview;
  const s = q.toString();
  return `${base}/activation${s ? "?" + s : ""}`;
}

async function envoyerLien(email: string, redirectTo: string, createUser: boolean) {
  const admin = await serviceClient();
  const { error } = await admin.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: createUser } });
  // Pas d'information sur l'existence d'un compte : erreur journalisée seulement.
  if (error) console.error("signInWithOtp", error.status, error.code);
}

export type Resultat = "ok" | "rate" | "invalid" | "not_published";

/** Demande d'accès à une édition PUBLIÉE : enregistre la demande, puis envoie lien + code. */
export async function requestAccess(i: { slug: string; lang: Lang; production: boolean; email: string; newsOptout: boolean; ip: string }): Promise<Resultat> {
  const q = await getQrEntry(i.slug, i.lang);
  if (q.kind !== "ok" || q.status !== "publiee") return "not_published";
  const email = normEmail(i.email);
  if (!email) return "invalid";
  if (!(await limites(email, i.ip))) return "rate";
  const { CONSENT_TEXT_VERSION } = await import("@/lib/consent");
  const admin = await serviceClient();
  const { error } = await admin.from("access_requests").insert({ email, edition_id: q.editionId, lang: i.lang, news_optout: i.newsOptout, consent_text_version: CONSENT_TEXT_VERSION });
  if (error) throw new Error("SAVE_FAILED");
  await logEvent("access_requested", q.editionId);
  await envoyerLien(email, await retourActivation(i.lang, i.production, q.editionId), true);
  return "ok";
}

/** Édition en préparation : seulement une ligne de liste d'attente. Aucun mail, aucun compte. */
export async function joinWaitlist(i: { slug: string; lang: Lang; email: string; newsOptout: boolean; ip: string }): Promise<Resultat> {
  const q = await getQrEntry(i.slug, i.lang);
  if (q.kind !== "ok" || q.status !== "preparation") return "invalid";
  const email = normEmail(i.email);
  if (!email) return "invalid";
  if (!(await limites(email, i.ip))) return "rate";
  const { CONSENT_TEXT_VERSION } = await import("@/lib/consent");
  const admin = await serviceClient();
  const { error } = await admin.from("launch_waitlist").upsert(
    { email, edition_id: q.editionId, lang: i.lang, news_optout: i.newsOptout, consent_text_version: CONSENT_TEXT_VERSION },
    { onConflict: "email,edition_id", ignoreDuplicates: true },
  );
  if (error) throw new Error("SAVE_FAILED");
  return "ok";
}

/** Lien de connexion depuis l'espace lecteur (ou renvoi après lien expiré). Ne crée aucun accès. */
export async function sendLoginLink(i: { email: string; lang: Lang; production: boolean; ip: string; editionId: string | null }): Promise<Resultat> {
  const email = normEmail(i.email);
  if (!email) return "invalid";
  if (!(await limites(email, i.ip))) return "rate";
  const admin = await serviceClient();
  let editionId: string | null = null;
  if (i.editionId) {
    // On ne garde l'édition que si une demande existe pour cette adresse.
    const { data } = await admin.from("access_requests").select("id").eq("email", email).eq("edition_id", i.editionId).limit(1);
    if (data?.length) editionId = i.editionId;
  }
  await envoyerLien(email, await retourActivation(i.lang, i.production, editionId), Boolean(editionId));
  return "ok";
}

async function estAdminOuEditeur(userId: string) {
  const admin = await serviceClient();
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "editor"]);
  return Boolean(data?.length);
}

async function toucherLecteur(userId: string) {
  const admin = await serviceClient();
  await admin.from("readers").update({ last_seen_at: new Date().toISOString() }).eq("user_id", userId);
}

/** Lecteur connecté qui scanne : accès si publiée ; sinon rien. */
export async function qrEnterAsReader(userId: string, slug: string, lang: Lang): Promise<"publiee" | "preparation" | "notfound"> {
  const q = await getQrEntry(slug, lang);
  if (q.kind !== "ok") return "notfound";
  if (q.status !== "publiee") return "preparation";
  const admin = await serviceClient();
  const now = new Date().toISOString();
  await admin.from("edition_access").upsert({ user_id: userId, edition_id: q.editionId, last_seen_at: now }, { onConflict: "user_id,edition_id" });
  await toucherLecteur(userId);
  return "publiee";
}

/** Lecteur connecté, édition en préparation : « Me prévenir à la parution ». */
export async function joinWaitlistAsReader(userId: string, email: string, slug: string, lang: Lang): Promise<Resultat> {
  const q = await getQrEntry(slug, lang);
  if (q.kind !== "ok" || q.status !== "preparation") return "invalid";
  const admin = await serviceClient();
  const { data: r } = await admin.from("readers").select("news_status").eq("user_id", userId).maybeSingle();
  const { CONSENT_TEXT_VERSION } = await import("@/lib/consent");
  const { error } = await admin.from("launch_waitlist").upsert(
    { email: email.toLowerCase(), edition_id: q.editionId, lang, news_optout: r?.news_status === "oppose", consent_text_version: CONSENT_TEXT_VERSION },
    { onConflict: "email,edition_id", ignoreDuplicates: true },
  );
  if (error) throw new Error("SAVE_FAILED");
  return "ok";
}

/**
 * Validation (lien ou code). Première validation : crée le lecteur avec le
 * choix de la demande ; ensuite, news_status n'est JAMAIS modifié.
 */
export async function confirmAccess(userId: string, rawEmail: string, editionId: string | null): Promise<{ granted: boolean }> {
  const email = rawEmail.toLowerCase();
  const admin = await serviceClient();
  let req = admin.from("access_requests").select("id, edition_id, news_optout, consent_text_version, confirmed_at, requested_at").eq("email", email);
  req = editionId ? req.eq("edition_id", editionId) : req.is("confirmed_at", null);
  const { data: reqs } = await req.order("requested_at", { ascending: false }).limit(20);
  const demande = (reqs ?? []).find((r) => !r.confirmed_at) ?? (reqs ?? [])[0] ?? null;
  const now = new Date().toISOString();
  if (!demande) {
    await toucherLecteur(userId);
    return { granted: false };
  }
  const { data: ed } = await admin.from("book_editions").select("id, lang, status").eq("id", demande.edition_id).maybeSingle();
  const { data: lecteur } = await admin.from("readers").select("user_id").eq("user_id", userId).maybeSingle();
  if (!lecteur) {
    const { randomBytes } = await import("node:crypto");
    const { error } = await admin.from("readers").insert({
      user_id: userId,
      email,
      lang: (ed?.lang as Lang) ?? "fr",
      news_status: demande.news_optout ? "oppose" : "inscrit",
      news_changed_at: now,
      consent_text_version: demande.consent_text_version,
      consent_at: now,
      origin_edition_id: ed?.id ?? null,
      unsubscribe_token: randomBytes(32).toString("hex"),
      last_seen_at: now,
    });
    if (error && error.code !== "23505") throw new Error("SAVE_FAILED");
  } else {
    await admin.from("readers").update({ last_seen_at: now, email }).eq("user_id", userId);
  }
  if (!ed || ed.status !== "publiee") return { granted: false };
  await admin.from("edition_access").upsert({ user_id: userId, edition_id: ed.id, last_seen_at: now }, { onConflict: "user_id,edition_id" });
  if (!demande.confirmed_at) {
    await admin.from("access_requests").update({ confirmed_at: now }).eq("id", demande.id);
    await logEvent("access_confirmed", ed.id);
  }
  return { granted: true };
}

export type EspaceLivre = { lang: Lang; slug: string; title: string | null; coverUrl: string | null };

/** Espace lecteur : ses éditions visibles, son choix de nouveautés. Met à jour last_seen_at. */
export async function readerSpace(userId: string) {
  const admin = await serviceClient();
  await toucherLecteur(userId);
  const [{ data: r }, { data: acc }] = await Promise.all([
    admin.from("readers").select("news_status").eq("user_id", userId).maybeSingle(),
    admin.from("edition_access").select("edition_id").eq("user_id", userId),
  ]);
  const ids = (acc ?? []).map((a) => a.edition_id);
  const livres: EspaceLivre[] = [];
  if (ids.length) {
    const { data: eds } = await admin.from("book_editions").select("id, lang, status, title, cover_path, book_id").in("id", ids).eq("status", "publiee");
    for (const e of eds ?? []) {
      const { data: vis } = await admin.rpc("edition_visible", { _edition_id: e.id });
      if (!vis) continue;
      const { data: b } = await admin.from("books").select("slug").eq("id", e.book_id).single();
      livres.push({
        lang: e.lang as Lang,
        slug: b?.slug ?? "",
        title: e.title,
        coverUrl: e.cover_path ? admin.storage.from("site").getPublicUrl(e.cover_path).data.publicUrl : null,
      });
    }
  }
  return { isReader: Boolean(r), news: r?.news_status === "inscrit", livres, isStaff: await estAdminOuEditeur(userId) };
}

export async function setReaderNews(userId: string, on: boolean): Promise<void> {
  const admin = await serviceClient();
  const { error } = await admin.from("readers").update({ news_status: on ? "inscrit" : "oppose", news_changed_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) throw new Error("SAVE_FAILED");
}

/**
 * Effacement complet d'un lecteur : utilisateur auth (cascade : readers,
 * edition_access, quiz_answers, reader_progress), demandes et liste d'attente
 * par adresse. Refusé pour un compte admin ou editor.
 */
export async function eraseReader(userId: string): Promise<"ok" | "staff"> {
  if (await estAdminOuEditeur(userId)) return "staff";
  const admin = await serviceClient();
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const { data: r } = await admin.from("readers").select("email").eq("user_id", userId).maybeSingle();
  const emails = [...new Set([u.user?.email, r?.email].filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))];
  for (const e of emails) {
    await admin.from("access_requests").delete().eq("email", e);
    await admin.from("launch_waitlist").delete().eq("email", e);
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error("DELETE_FAILED");
  return "ok";
}

/** Désinscription par jeton, sans connexion. L'accès au compagnon ne change pas. */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const admin = await serviceClient();
  const { data } = await admin.from("readers").update({ news_status: "oppose", news_changed_at: new Date().toISOString() }).eq("unsubscribe_token", token).select("user_id");
  return Boolean(data?.length);
}
