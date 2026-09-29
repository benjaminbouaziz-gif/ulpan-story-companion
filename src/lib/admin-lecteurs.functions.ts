import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { absoluteUrl } from "@/i18n/routes";

/** ADMIN — lecteurs, listes d'attente, demandes, chiffres. requireSupabaseAuth → assertEditor → getAdminClient. */
async function editorAdmin(context: { supabase: Parameters<typeof import("@/lib/editor-context.server").assertEditor>[0]; userId: string }) {
  const { assertEditor } = await import("@/lib/editor-context.server");
  const { getAdminClient } = await import("@/lib/supabase-admin.server");
  return getAdminClient(await assertEditor(context.supabase, context.userId));
}
type Admin = Awaited<ReturnType<typeof editorAdmin>>;
const uuid = z.string().uuid();
const NONE = ["00000000-0000-0000-0000-000000000000"];

/** Cellule CSV : protégée contre les formules (=, +, -, @), puis entre guillemets. */
export function cellule(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cellule).join(",")).join("\r\n") + "\r\n";

async function libellesEditions(admin: Admin, ids: string[]) {
  const { data: eds } = await admin.from("book_editions").select("id, lang, book_id").in("id", ids.length ? ids : NONE);
  const bookIds = [...new Set((eds ?? []).map((e) => e.book_id))];
  const { data: books } = await admin.from("books").select("id, slug").in("id", bookIds.length ? bookIds : NONE);
  const m = new Map<string, { slug: string; lang: string; label: string }>();
  for (const e of eds ?? []) {
    const slug = books?.find((b) => b.id === e.book_id)?.slug ?? "?";
    m.set(e.id, { slug, lang: e.lang, label: `${slug} (${e.lang.toUpperCase()})` });
  }
  return m;
}

async function tout<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await q(i, i + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export const adminLecteursListe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().trim().max(254), page: z.number().int().min(0).max(100000) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    let q = admin.from("readers").select("user_id, email, lang, created_at, last_seen_at, news_status", { count: "exact" });
    if (data.q) q = q.ilike("email", `%${data.q.replace(/[%_\\]/g, (c) => "\\" + c)}%`);
    const { data: rows, count } = await q.order("created_at", { ascending: false }).range(data.page * 50, data.page * 50 + 49);
    const ids = (rows ?? []).map((r) => r.user_id);
    const { data: acc } = await admin.from("edition_access").select("user_id, edition_id").in("user_id", ids.length ? ids : NONE);
    const lib = await libellesEditions(admin, [...new Set((acc ?? []).map((a) => a.edition_id))]);
    return {
      total: count ?? 0,
      rows: (rows ?? []).map((r) => ({
        userId: r.user_id, email: r.email, lang: r.lang, createdAt: r.created_at, lastSeenAt: r.last_seen_at, news: r.news_status,
        editions: (acc ?? []).filter((a) => a.user_id === r.user_id).map((a) => lib.get(a.edition_id)?.label ?? "?"),
      })),
    };
  });

export const adminExportInscrits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await editorAdmin(context);
    const rows = await tout((a, b) => admin.from("readers").select("email, lang, created_at, origin_edition_id, unsubscribe_token").eq("news_status", "inscrit").order("created_at").range(a, b));
    const lib = await libellesEditions(admin, [...new Set(rows.map((r) => r.origin_edition_id).filter((x): x is string => Boolean(x)))]);
    return csv([
      ["email", "langue", "inscrit_le", "edition_origine", "lien_desinscription"],
      ...rows.map((r) => {
        const l = r.lang === "en" ? "en" : "fr";
        return [r.email, r.lang, r.created_at, r.origin_edition_id ? lib.get(r.origin_edition_id)?.label ?? "" : "", `${absoluteUrl("desinscription", l)}?t=${r.unsubscribe_token}`];
      }),
    ]);
  });

export const adminLecteurDonnees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: lecteur } = await admin.from("readers").select("*").eq("user_id", data.userId).maybeSingle();
    if (!lecteur) throw new Error("READER_NOT_FOUND");
    const [acces, demandes, attente, reponses, progression] = await Promise.all([
      admin.from("edition_access").select("*").eq("user_id", data.userId),
      admin.from("access_requests").select("*").eq("email", lecteur.email),
      admin.from("launch_waitlist").select("*").eq("email", lecteur.email),
      admin.from("quiz_answers").select("*").eq("user_id", data.userId),
      admin.from("reader_progress").select("*").eq("user_id", data.userId),
    ]);
    return JSON.stringify({ lecteur, acces: acces.data, demandes: demandes.data, liste_attente: attente.data, reponses_quiz: reponses.data, progression: progression.data }, null, 2);
  });

export const adminSupprimerLecteur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { effacerLecteur } = await import("@/lib/effacement.server");
    const r = await effacerLecteur(admin, data.userId);
    if (r === "staff") throw new Error("READER_STAFF");
    return { ok: true };
  });

export const adminListesAttente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await editorAdmin(context);
    const rows = await tout((a, b) => admin.from("launch_waitlist").select("email, edition_id, created_at, news_optout, notified_at").order("created_at").range(a, b));
    const lib = await libellesEditions(admin, [...new Set(rows.map((r) => r.edition_id))]);
    const par = new Map<string, typeof rows>();
    for (const r of rows) par.set(r.edition_id, [...(par.get(r.edition_id) ?? []), r]);
    return [...par.entries()].map(([editionId, list]) => ({
      editionId, label: lib.get(editionId)?.label ?? "?",
      rows: list.map((r) => ({ email: r.email, createdAt: r.created_at, news: r.news_optout ? "opposé" : "inscrit", notifiedAt: r.notified_at })),
    }));
  });

export const adminExportAttente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ editionId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const rows = await tout((a, b) => admin.from("launch_waitlist").select("email, lang, created_at, news_optout, notified_at").eq("edition_id", data.editionId).order("created_at").range(a, b));
    return csv([["email", "langue", "inscrit_le", "nouveautes", "prevenu_le"], ...rows.map((r) => [r.email, r.lang, r.created_at, r.news_optout ? "oppose" : "inscrit", r.notified_at ?? ""])]);
  });

export const adminMarquerPrevenus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ editionId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { error } = await admin.from("launch_waitlist").update({ notified_at: new Date().toISOString() }).eq("edition_id", data.editionId).is("notified_at", null);
    if (error) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

export const adminDemandesEnAttente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await editorAdmin(context);
    const { data } = await admin.from("access_requests").select("id, email, edition_id, requested_at").is("confirmed_at", null).order("requested_at", { ascending: false }).limit(500);
    const lib = await libellesEditions(admin, [...new Set((data ?? []).map((r) => r.edition_id))]);
    return (data ?? []).map((r) => ({ id: r.id, email: r.email, edition: lib.get(r.edition_id)?.label ?? "?", requestedAt: r.requested_at }));
  });

const mois = z.string().regex(/^\d{4}-\d{2}$/);

export const adminChiffres = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: mois, to: mois }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const [y, m] = data.to.split("-").map(Number) as [number, number];
    const fin = new Date(Date.UTC(y, m, 1)).toISOString();
    const rows = await tout((a, b) => admin.from("events").select("type, edition_id, created_at").gte("created_at", `${data.from}-01T00:00:00Z`).lt("created_at", fin).order("created_at").range(a, b));
    const lib = await libellesEditions(admin, [...new Set(rows.map((r) => r.edition_id).filter((x): x is string => Boolean(x)))]);
    const cle = new Map<string, { edition: string; mois: string; qr_scan: number; access_requested: number; access_confirmed: number; amazon_click: number }>();
    for (const r of rows) {
      const ed = r.edition_id ? lib.get(r.edition_id)?.label ?? "(édition supprimée)" : "(édition supprimée)";
      const mo = r.created_at.slice(0, 7);
      const k = `${ed}|${mo}`;
      const cur = cle.get(k) ?? { edition: ed, mois: mo, qr_scan: 0, access_requested: 0, access_confirmed: 0, amazon_click: 0 };
      cur[r.type as "qr_scan"] += 1;
      cle.set(k, cur);
    }
    return [...cle.values()].sort((a, b) => a.edition.localeCompare(b.edition) || a.mois.localeCompare(b.mois));
  });
