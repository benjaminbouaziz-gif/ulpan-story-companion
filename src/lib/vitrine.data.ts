/**
 * Lectures de la vitrine publique, partagées par les pages publiques (clé
 * publique, sous RLS, mode "public") et les aperçus de l'admin (client
 * éditeur, mode "apercu" : le non-publié est montré et marqué `hidden`).
 * Jamais de repli d'une langue sur l'autre.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { BlockKind, PageKey } from "./site-blocks";

type Db = SupabaseClient<Database>;
export type Lang = "fr" | "en";
export type Mode = "public" | "apercu";
const SITE = "site";

export type VBlock = {
  id: string;
  kind: BlockKind;
  title: string | null;
  body: string | null;
  items: Record<string, string>[];
  imageUrl: string | null;
  hidden: boolean;
};
export type VStep = { stepNo: number; label: string; imageUrl: string | null };
export type VCard = { editionId: string; slug: string; tome: number | null; title: string; coverUrl: string | null; hidden: boolean };
export type VCollCard = { slug: string; name: string; tagline: string | null; color: string; hidden: boolean };

const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

function fileUrl(db: Db, path: string | null, v?: string | null): string | null {
  if (!path) return null;
  const u = db.storage.from(SITE).getPublicUrl(path).data.publicUrl;
  return v ? `${u}?v=${encodeURIComponent(v)}` : u;
}

type RawBlock = { id: string; kind: string; title: string | null; body: string | null; items: unknown; image_path: string | null; is_visible: boolean; updated_at: string };

function toBlocks(db: Db, rows: RawBlock[] | null, mode: Mode): VBlock[] {
  return (rows ?? [])
    .filter((r) => mode === "apercu" || r.is_visible)
    .map((r) => ({
      id: r.id,
      kind: r.kind as BlockKind,
      title: clean(r.title),
      body: clean(r.body),
      items: Array.isArray(r.items) ? (r.items as Record<string, string>[]) : [],
      imageUrl: fileUrl(db, r.image_path, r.updated_at),
      hidden: !r.is_visible,
    }))
    .filter((b) => b.title || b.body || b.items.length || b.imageUrl);
}

export async function siteBlocks(db: Db, pageKey: PageKey, lang: Lang, mode: Mode): Promise<VBlock[]> {
  let q = db.from("site_blocks").select("id,kind,title,body,items,image_path,is_visible,updated_at").eq("page_key", pageKey).eq("lang", lang);
  if (mode === "public") q = q.eq("is_visible", true);
  const { data, error } = await q.order("sort_order");
  if (error) throw new Error(error.message);
  return toBlocks(db, data as RawBlock[], mode);
}

async function collectionBlocks(db: Db, collectionId: string, lang: Lang, mode: Mode): Promise<VBlock[]> {
  let q = db.from("collection_blocks").select("id,kind,title,body,image_path,is_visible,updated_at").eq("collection_id", collectionId).eq("lang", lang);
  if (mode === "public") q = q.eq("is_visible", true);
  const { data, error } = await q.order("sort_order");
  if (error) throw new Error(error.message);
  return toBlocks(db, (data ?? []).map((r) => ({ ...r, items: [] })) as RawBlock[], mode);
}

export async function methodSteps(db: Db, lang: Lang): Promise<VStep[]> {
  const { data, error } = await db.from("method_steps").select("step_no,tab_label,image_path,updated_at").eq("lang", lang).order("step_no");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({ stepNo: s.step_no, label: s.tab_label, imageUrl: fileUrl(db, s.image_path, s.updated_at) }));
}

/* ---------- Éditions ---------- */

type EdRow = {
  id: string; status: string; title: string | null; subtitle: string | null; blurb: string | null; level_note: string | null;
  learn_items: string[]; amazon_url: string | null; cover_path: string | null; excerpt_path: string | null;
  print_page_count: number | null; published_at: string | null; updated_at: string; lang: string;
  books: {
    id: string; slug: string; tome_no: number | null; title_he: string | null; chapters_count: number | null; vocab_count: number | null;
    collection_id: string | null; updated_at: string;
    collections: { id: string; slug: string; color_hex: string; is_visible: boolean; sort_order: number } | null;
  };
};
const ED_SELECT =
  "id,status,title,subtitle,blurb,level_note,learn_items,amazon_url,cover_path,excerpt_path,print_page_count,published_at,updated_at,lang," +
  "books!inner(id,slug,tome_no,title_he,chapters_count,vocab_count,collection_id,updated_at,collections(id,slug,color_hex,is_visible,sort_order))";

const edVisible = (e: EdRow) => e.status === "publiee" && !!e.books.collections?.is_visible;

async function editions(db: Db, lang: Lang, mode: Mode, filter?: { bookSlug?: string; collectionId?: string; editionId?: string }): Promise<EdRow[]> {
  let q = db.from("book_editions").select(ED_SELECT).eq("lang", lang);
  if (mode === "public") q = q.eq("status", "publiee");
  if (filter?.bookSlug) q = q.eq("books.slug", filter.bookSlug);
  if (filter?.collectionId) q = q.eq("books.collection_id", filter.collectionId);
  if (filter?.editionId) q = q.eq("id", filter.editionId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as EdRow[];
  return mode === "public" ? rows.filter(edVisible) : rows;
}

function toCard(db: Db, e: EdRow): VCard {
  return { editionId: e.id, slug: e.books.slug, tome: e.books.tome_no, title: clean(e.title) ?? e.books.slug, coverUrl: fileUrl(db, e.cover_path, e.updated_at), hidden: !edVisible(e) };
}

/* ---------- Collections ---------- */

type CollRow = { id: string; slug: string; color_hex: string; is_visible: boolean; sort_order: number; updated_at: string };
type CollText = { name: string | null; tagline: string | null; description: string | null; for_whom: string | null };

async function collectionText(db: Db, id: string, lang: Lang): Promise<CollText | null> {
  const { data } = await db.from("collection_texts").select("name,tagline,description,for_whom").eq("collection_id", id).eq("lang", lang).maybeSingle();
  return data;
}

async function collectionCards(db: Db, lang: Lang, mode: Mode): Promise<VCollCard[]> {
  let q = db.from("collections").select("id,slug,color_hex,is_visible,sort_order,updated_at");
  if (mode === "public") q = q.eq("is_visible", true);
  const { data: cols, error } = await q.order("sort_order");
  if (error) throw new Error(error.message);
  const eds = await editions(db, lang, mode);
  const visibleIn = new Set(eds.filter(edVisible).map((e) => e.books.collection_id));
  const anyIn = new Set(eds.map((e) => e.books.collection_id));
  const out: VCollCard[] = [];
  for (const c of (cols ?? []) as CollRow[]) {
    const pub = c.is_visible && visibleIn.has(c.id);
    if (mode === "public" && !pub) continue;
    if (mode === "apercu" && !anyIn.has(c.id) && !c.is_visible) continue;
    const t = await collectionText(db, c.id, lang);
    const name = clean(t?.name);
    if (!name && mode === "public") continue;
    out.push({ slug: c.slug, name: name ?? c.slug, tagline: clean(t?.tagline), color: c.color_hex, hidden: !pub });
  }
  return out;
}

/* ---------- Pages ---------- */

export type HomeData = {
  ouverture: VBlock[]; methode: VBlock[]; livres: VBlock[]; collectionsBlocks: VBlock[]; lecteur: VBlock[];
  steps: VStep[]; editions: HomeCard[]; collections: VCollCard[]; hidden: boolean; alternateExists: true;
};
/** Carte de l'accueil : ce qu'il faut pour la présentation « à la une ». */
export type HomeCard = VCard & { blurb: string | null; amazonUrl: string | null; collectionName: string | null };

export async function homeData(db: Db, lang: Lang, mode: Mode): Promise<HomeData> {
  const [ouverture, methode, livres, collectionsBlocks, lecteur, steps, eds, collections] = await Promise.all([
    siteBlocks(db, "accueil_ouverture", lang, mode),
    siteBlocks(db, "accueil_methode", lang, mode),
    siteBlocks(db, "accueil_livres", lang, mode),
    siteBlocks(db, "accueil_collections", lang, mode),
    siteBlocks(db, "accueil_lecteur", lang, mode),
    methodSteps(db, lang),
    editions(db, lang, mode),
    collectionCards(db, lang, mode),
  ]);
  const sorted = [...eds].sort((a, b) => (b.published_at ?? b.updated_at).localeCompare(a.published_at ?? a.updated_at));
  const collIds = [...new Set(sorted.map((e) => e.books.collections?.id).filter((x): x is string => !!x))];
  const names = new Map(await Promise.all(collIds.map(async (id) => [id, clean((await collectionText(db, id, lang))?.name)] as const)));
  const cards: HomeCard[] = sorted.map((e) => ({
    ...toCard(db, e),
    blurb: clean(e.blurb),
    amazonUrl: clean(e.amazon_url),
    collectionName: e.books.collections ? names.get(e.books.collections.id) ?? null : null,
  }));
  const hidden = [ouverture, methode, livres, collectionsBlocks, lecteur].flat().some((b) => b.hidden) || cards.some((c) => c.hidden) || collections.some((c) => c.hidden);
  return { ouverture, methode, livres, collectionsBlocks, lecteur, steps, editions: cards, collections, hidden, alternateExists: true };
}

export type BlocksPageData = { blocks: VBlock[]; steps: VStep[]; hidden: boolean; alternateExists: true };

export async function blocksPageData(db: Db, pageKey: PageKey, lang: Lang, mode: Mode, withSteps = false): Promise<BlocksPageData> {
  const [blocks, steps] = await Promise.all([siteBlocks(db, pageKey, lang, mode), withSteps ? methodSteps(db, lang) : Promise.resolve([])]);
  return { blocks, steps, hidden: blocks.some((b) => b.hidden), alternateExists: true };
}

export async function collectionsData(db: Db, lang: Lang, mode: Mode) {
  const collections = await collectionCards(db, lang, mode);
  return { collections, hidden: collections.some((c) => c.hidden), alternateExists: true as const };
}

export type CollectionData = {
  slug: string; name: string; tagline: string | null; description: string | null; forWhom: string | null; color: string;
  blocks: VBlock[]; tomes: VCard[]; hidden: boolean; alternateExists: boolean; updatedAt: string;
};

export async function collectionData(db: Db, lang: Lang, mode: Mode, by: { slug?: string; id?: string }): Promise<CollectionData | null> {
  let q = db.from("collections").select("id,slug,color_hex,is_visible,sort_order,updated_at");
  q = by.id ? q.eq("id", by.id) : q.eq("slug", by.slug ?? "");
  const { data: c } = await q.maybeSingle();
  if (!c) return null;
  const all = await editions(db, lang, mode, { collectionId: c.id });
  const visibleCount = all.filter(edVisible).length;
  const pub = c.is_visible && visibleCount > 0;
  if (mode === "public" && !pub) return null;
  const [t, blocks] = await Promise.all([collectionText(db, c.id, lang), collectionBlocks(db, c.id, lang, mode)]);
  const name = clean(t?.name);
  if (!name && mode === "public") return null;
  const other: Lang = lang === "fr" ? "en" : "fr";
  const otherEds = c.is_visible ? await editions(db, other, "public", { collectionId: c.id }) : [];
  const otherText = otherEds.length ? await collectionText(db, c.id, other) : null;
  const tomes = [...all].sort((a, b) => (a.books.tome_no ?? 999) - (b.books.tome_no ?? 999)).map((e) => toCard(db, e));
  return {
    slug: c.slug, name: name ?? c.slug, tagline: clean(t?.tagline), description: clean(t?.description), forWhom: clean(t?.for_whom),
    color: c.color_hex, blocks, tomes,
    hidden: !pub || blocks.some((b) => b.hidden) || tomes.some((x) => x.hidden),
    alternateExists: otherEds.length > 0 && !!clean(otherText?.name),
    updatedAt: c.updated_at,
  };
}

export type BookData = {
  editionId: string; slug: string; tome: number | null; title: string; subtitle: string | null; titleHe: string | null; blurb: string | null;
  amazonUrl: string | null; coverUrl: string | null; excerptUrl: string | null; learnItems: string[];
  chapters: number | null; vocab: number | null; pages: number | null; levelNote: string | null;
  collection: { slug: string; name: string | null; color: string } | null;
  sameCollection: VCard[]; hidden: boolean; alternateExists: boolean;
};

export async function bookData(db: Db, lang: Lang, mode: Mode, by: { slug?: string; editionId?: string }): Promise<BookData | null> {
  const rows = await editions(db, lang, mode, by.editionId ? { editionId: by.editionId } : { bookSlug: by.slug ?? "" });
  const e = rows[0];
  if (!e) return null;
  const b = e.books;
  const coll = b.collections;
  const other: Lang = lang === "fr" ? "en" : "fr";
  const [collText, siblings, otherEd] = await Promise.all([
    coll ? collectionText(db, coll.id, lang) : Promise.resolve(null),
    coll ? editions(db, lang, "public", { collectionId: coll.id }) : Promise.resolve([]),
    editions(db, other, "public", { bookSlug: b.slug }),
  ]);
  const pos = (n: number | null) => (n && n > 0 ? n : null);
  return {
    editionId: e.id, slug: b.slug, tome: b.tome_no, title: clean(e.title) ?? b.slug, subtitle: clean(e.subtitle), titleHe: clean(b.title_he),
    blurb: clean(e.blurb), amazonUrl: clean(e.amazon_url), coverUrl: fileUrl(db, e.cover_path, e.updated_at), excerptUrl: fileUrl(db, e.excerpt_path, e.updated_at),
    learnItems: (e.learn_items ?? []).map((s) => s.trim()).filter(Boolean),
    chapters: pos(b.chapters_count), vocab: pos(b.vocab_count), pages: pos(e.print_page_count), levelNote: clean(e.level_note),
    collection: coll ? { slug: coll.slug, name: clean(collText?.name), color: coll.color_hex } : null,
    sameCollection: siblings.sort((x, y) => (x.books.tome_no ?? 999) - (y.books.tome_no ?? 999)).map((s) => toCard(db, s)),
    hidden: !edVisible(e),
    alternateExists: otherEd.length > 0,
  };
}

/** Pour le sitemap : collections et livres visibles de la langue. */
export async function sitemapEntries(db: Db, lang: Lang) {
  const eds = await editions(db, lang, "public");
  const books = eds.map((e) => ({ slug: e.books.slug, updatedAt: e.updated_at > e.books.updated_at ? e.updated_at : e.books.updated_at }));
  const cards = await collectionCards(db, lang, "public");
  const { data: cols } = await db.from("collections").select("slug,updated_at").in("slug", cards.map((c) => c.slug).concat(["\u0000"]));
  return { books, collections: (cols ?? []).map((c) => ({ slug: c.slug, updatedAt: c.updated_at })) };
}

/** Couleurs de la bande du site : mêmes collections que collectionCards en mode public. */
export async function stripeColors(db: Db, lang: Lang): Promise<string[]> {
  return (await collectionCards(db, lang, "public")).map((c) => c.color);
}
