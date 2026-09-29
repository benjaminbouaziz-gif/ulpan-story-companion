import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyserColle, natureDuBloc, parseColle } from "@/lib/coller-livre";
import { extensionAudio, slugProbleme } from "@/lib/slug";

/**
 * ADMIN — livres, pages hébreu et audio. Toute fonction suit :
 * requireSupabaseAuth → assertEditor (rôle lu en base) → getAdminClient.
 * Les erreurs sont des codes ; la phrase française est choisie à l'écran.
 */
const AUDIO_BUCKET = "audios";
const MAX_AUDIO = 50 * 1024 * 1024;
const SIGNED_SECONDS = 60;

async function editorAdmin(context: { supabase: Parameters<typeof import("@/lib/editor-context.server").assertEditor>[0]; userId: string }) {
  const { assertEditor } = await import("@/lib/editor-context.server");
  const { getAdminClient } = await import("@/lib/supabase-admin.server");
  const editor = await assertEditor(context.supabase, context.userId);
  return getAdminClient(editor);
}
type Admin = Awaited<ReturnType<typeof editorAdmin>>;

const uuid = z.string().uuid();
const optInt = z.number().int().min(0).max(100000).nullable();
const optText = z.string().trim().max(500).nullable();

function nul(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

async function slugLibre(admin: Admin, slug: string, exceptBookId?: string) {
  const p = slugProbleme(slug);
  if (p) throw new Error(p);
  const { data: b } = await admin.from("books").select("id").eq("slug", slug).maybeSingle();
  if (b && b.id !== exceptBookId) throw new Error("SLUG_TAKEN");
  const { data: c } = await admin.from("collections").select("id").eq("slug", slug).maybeSingle();
  if (c) throw new Error("SLUG_TAKEN");
}

async function livreParSlug(admin: Admin, slug: string) {
  const { data } = await admin.from("books").select("*").eq("slug", slug).maybeSingle();
  if (!data) throw new Error("BOOK_NOT_FOUND");
  return data;
}

function publicCover(admin: Admin, path: string | null) {
  if (!path) return null;
  return admin.storage.from("site").getPublicUrl(path).data.publicUrl;
}

/* ------------------------------------------------------------------ */
/* Liste, collections, création                                        */
/* ------------------------------------------------------------------ */

export type EditionPastille = { lang: "fr" | "en"; status: "preparation" | "publiee"; id: string };

export const adminCollectionsChoix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await editorAdmin(context);
    const { data: cols } = await admin.from("collections").select("id, slug").order("sort_order");
    const { data: texts } = await admin.from("collection_texts").select("collection_id, lang, name");
    return (cols ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: texts?.find((t) => t.collection_id === c.id && t.lang === "fr")?.name ?? null,
    }));
  });

export const adminLivres = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await editorAdmin(context);
    const { data: books } = await admin
      .from("books")
      .select("id, slug, tome_no, title_he, collection_id")
      .order("created_at");
    const ids = (books ?? []).map((b) => b.id);
    const [{ data: eds }, { data: pages }, { data: cols }] = await Promise.all([
      admin.from("book_editions").select("id, book_id, lang, status, cover_path").in("book_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("book_pages").select("book_id, audio_path").in("book_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("collections").select("id, slug"),
    ]);
    return (books ?? []).map((b) => {
      const own = (eds ?? []).filter((e) => e.book_id === b.id);
      const cover = (lang: string) => publicCover(admin, own.find((e) => e.lang === lang)?.cover_path ?? null);
      const pg = (pages ?? []).filter((p) => p.book_id === b.id);
      return {
        id: b.id,
        slug: b.slug,
        tomeNo: b.tome_no,
        titleHe: b.title_he,
        collection: cols?.find((c) => c.id === b.collection_id)?.slug ?? null,
        coverFr: cover("fr"),
        coverEn: cover("en"),
        editions: own.map((e) => ({ id: e.id, lang: e.lang, status: e.status }) as EditionPastille),
        pages: pg.length,
        pagesAudio: pg.filter((p) => p.audio_path).length,
      };
    });
  });

const livreChamps = z.object({
  slug: z.string().trim().max(80),
  collectionId: uuid.nullable(),
  tomeNo: optInt,
  titleHe: optText,
});

export const createLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => livreChamps.parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    await slugLibre(admin, data.slug);
    const { data: row, error } = await admin
      .from("books")
      .insert({ slug: data.slug, collection_id: data.collectionId, tome_no: data.tomeNo, title_he: nul(data.titleHe) })
      .select("slug")
      .single();
    if (error) throw new Error(error.code === "23505" ? "SLUG_TAKEN" : "SAVE_FAILED");
    return { slug: row.slug };
  });

/* ------------------------------------------------------------------ */
/* Fiche                                                               */
/* ------------------------------------------------------------------ */

export const adminLivre = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string().max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const book = await livreParSlug(admin, data.slug);
    const [{ data: eds }, { data: pages }, { data: chaps }] = await Promise.all([
      admin.from("book_editions").select("id, lang, status").eq("book_id", book.id),
      admin.from("book_pages").select("id, page_no, chapter_no, audio_path, is_published").eq("book_id", book.id).order("page_no"),
      admin.from("book_chapters").select("chapter_no, title_he").eq("book_id", book.id),
    ]);
    const pageIds = (pages ?? []).map((p) => p.id);
    const counts = new Map<string, number>();
    for (let i = 0; i < pageIds.length; i += 200) {
      const { data: part } = await admin.from("page_paragraphs").select("page_id").in("page_id", pageIds.slice(i, i + 200));
      for (const r of part ?? []) counts.set(r.page_id, (counts.get(r.page_id) ?? 0) + 1);
    }
    const chapterNos = [...new Set((pages ?? []).map((p) => p.chapter_no))].sort((a, b) => a - b);
    return {
      book: {
        id: book.id,
        slug: book.slug,
        collectionId: book.collection_id,
        tomeNo: book.tome_no,
        titleHe: book.title_he,
        chaptersCount: book.chapters_count,
        vocabCount: book.vocab_count,
        slugLocked: Boolean(book.slug_locked_at),
      },
      editions: (eds ?? []) as EditionPastille[],
      chapters: chapterNos.map((n) => ({
        chapterNo: n,
        titleHe: chaps?.find((c) => c.chapter_no === n)?.title_he ?? "",
      })),
      pages: (pages ?? []).map((p) => ({
        id: p.id,
        pageNo: p.page_no,
        chapterNo: p.chapter_no,
        paragraphs: counts.get(p.id) ?? 0,
        hasAudio: Boolean(p.audio_path),
        isPublished: p.is_published,
      })),
    };
  });

export const saveLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    livreChamps.extend({ id: uuid, chaptersCount: optInt, vocabCount: optInt }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: book } = await admin.from("books").select("slug, slug_locked_at").eq("id", data.id).maybeSingle();
    if (!book) throw new Error("BOOK_NOT_FOUND");
    if (data.slug !== book.slug) {
      if (book.slug_locked_at) throw new Error("SLUG_LOCKED");
      await slugLibre(admin, data.slug, data.id);
    }
    const { error } = await admin
      .from("books")
      .update({
        slug: data.slug,
        collection_id: data.collectionId,
        tome_no: data.tomeNo,
        title_he: nul(data.titleHe),
        chapters_count: data.chaptersCount,
        vocab_count: data.vocabCount,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.code === "23505" ? "SLUG_TAKEN" : "SAVE_FAILED");
    return { slug: data.slug };
  });

export const saveChapterTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      bookId: uuid,
      titles: z.array(z.object({ chapterNo: z.number().int().min(0).max(10000), titleHe: z.string().max(500) })).max(1000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    if (data.titles.length === 0) return { ok: true };
    const { error } = await admin.from("book_chapters").upsert(
      data.titles.map((t) => ({ book_id: data.bookId, chapter_no: t.chapterNo, title_he: nul(t.titleHe) })),
      { onConflict: "book_id,chapter_no" },
    );
    if (error) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

export const addEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bookId: uuid, lang: z.enum(["fr", "en"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { error } = await admin.from("book_editions").insert({ book_id: data.bookId, lang: data.lang, status: "preparation" });
    if (error) throw new Error(error.code === "23505" ? "EDITION_EXISTS" : "SAVE_FAILED");
    return { ok: true };
  });

export const deleteEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ editionId: uuid, confirmSlug: z.string().max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: ed } = await admin.from("book_editions").select("id, status, book_id").eq("id", data.editionId).maybeSingle();
    if (!ed) throw new Error("EDITION_NOT_FOUND");
    if (ed.status === "publiee") throw new Error("EDITION_PUBLISHED");
    const { data: book } = await admin.from("books").select("slug").eq("id", ed.book_id).single();
    if (!book || book.slug !== data.confirmSlug) throw new Error("CONFIRM_MISMATCH");
    // Le slug reste verrouillé : on ne touche jamais slug_locked_at.
    const { error } = await admin.from("book_editions").delete().eq("id", ed.id);
    if (error) throw new Error("DELETE_FAILED");
    return { ok: true };
  });

export const deleteLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bookId: uuid, confirmSlug: z.string().max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: book } = await admin.from("books").select("id, slug, slug_locked_at").eq("id", data.bookId).maybeSingle();
    if (!book) throw new Error("BOOK_NOT_FOUND");
    if (book.slug !== data.confirmSlug) throw new Error("CONFIRM_MISMATCH");
    if (book.slug_locked_at) throw new Error("SLUG_LOCKED");
    const { data: eds } = await admin.from("book_editions").select("id, status").eq("book_id", book.id);
    if ((eds ?? []).some((e) => e.status === "publiee")) throw new Error("EDITION_PUBLISHED");
    const { data: pages } = await admin.from("book_pages").select("audio_path").eq("book_id", book.id);
    if ((eds ?? []).length) {
      const { error } = await admin.from("book_editions").delete().eq("book_id", book.id);
      if (error) throw new Error("DELETE_FAILED");
    }
    const { error } = await admin.from("books").delete().eq("id", book.id);
    if (error) throw new Error("DELETE_FAILED");
    const paths = (pages ?? []).map((p) => p.audio_path).filter((p): p is string => Boolean(p));
    if (paths.length) await admin.storage.from(AUDIO_BUCKET).remove(paths);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Pages : publication, collage, paragraphes                           */
/* ------------------------------------------------------------------ */

export const setPagePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pageId: uuid, value: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { error } = await admin.from("book_pages").update({ is_published: data.value }).eq("id", data.pageId);
    if (error) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

export const setAllPagesPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bookId: uuid, value: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { error } = await admin.from("book_pages").update({ is_published: data.value }).eq("book_id", data.bookId);
    if (error) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

export const collerHebreu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      bookId: uuid,
      nikud: z.string().max(3_000_000),
      plain: z.string().max(3_000_000),
      remplacer: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: existing } = await admin.from("book_pages").select("id, page_no").eq("book_id", data.bookId);
    const byNo = new Map((existing ?? []).map((p) => [p.page_no, p.id]));

    // Le serveur refait l'analyse : il n'écrit que ce qu'il a lui-même vérifié.
    const analyse = analyserColle(data.nikud, data.plain, [...byNo.keys()], data.remplacer);
    if (!analyse.ok) throw new Error("PASTE_INVALID");
    const g = new Map(parseColle(data.nikud).pages.map((p) => [p.pageNo, p]));
    const d = new Map(parseColle(data.plain).pages.map((p) => [p.pageNo, p]));

    // Pages nouvelles, en lot.
    const nouvelles = analyse.lignes.filter((l) => l.verdict === "ok");
    const created: string[] = [];
    if (nouvelles.length) {
      const { data: rows, error } = await admin
        .from("book_pages")
        .insert(nouvelles.map((l) => ({ book_id: data.bookId, page_no: l.pageNo, chapter_no: g.get(l.pageNo)!.chapterNo })))
        .select("id, page_no");
      if (error) throw new Error(error.code === "23505" ? "PAGE_NO_TAKEN" : "SAVE_FAILED");
      for (const r of rows ?? []) {
        byNo.set(r.page_no, r.id);
        created.push(r.id);
      }
    }
    // Remplacements : chapitre mis à jour, anciens paragraphes retirés.
    const remplacees = analyse.lignes.filter((l) => l.verdict === "remplacement");
    for (const l of remplacees) {
      const id = byNo.get(l.pageNo)!;
      await admin.from("book_pages").update({ chapter_no: g.get(l.pageNo)!.chapterNo }).eq("id", id);
      await admin.from("page_paragraphs").delete().eq("page_id", id);
    }

    const paras = analyse.lignes.flatMap((l) => {
      const gp = g.get(l.pageNo)!.paragraphs;
      const dp = d.get(l.pageNo)!.paragraphs;
      return gp.map((he, i) => ({
        page_id: byNo.get(l.pageNo)!,
        sort_order: i + 1,
        kind: natureDuBloc(he),
        he_nikud: he,
        he_plain: dp[i]!, // saisi, jamais déduit
      }));
    });
    for (let i = 0; i < paras.length; i += 500) {
      const { error } = await admin.from("page_paragraphs").insert(paras.slice(i, i + 500));
      if (error) {
        if (created.length) await admin.from("book_pages").delete().in("id", created);
        throw new Error("SAVE_FAILED");
      }
    }
    return { pages: analyse.lignes.length, paragraphs: paras.length };
  });

export const adminPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string().max(80), pageNo: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const book = await livreParSlug(admin, data.slug);
    const { data: pages } = await admin.from("book_pages").select("id, page_no, chapter_no, audio_path, is_published").eq("book_id", book.id).order("page_no");
    const idx = (pages ?? []).findIndex((p) => p.page_no === data.pageNo);
    if (idx < 0) throw new Error("PAGE_NOT_FOUND");
    const page = pages![idx]!;
    const { data: paras } = await admin.from("page_paragraphs").select("id, sort_order, kind, he_nikud, he_plain").eq("page_id", page.id).order("sort_order");
    return {
      book: { id: book.id, slug: book.slug, titleHe: book.title_he },
      page: { id: page.id, pageNo: page.page_no, chapterNo: page.chapter_no, hasAudio: Boolean(page.audio_path), isPublished: page.is_published },
      prev: pages![idx - 1]?.page_no ?? null,
      next: pages![idx + 1]?.page_no ?? null,
      paragraphs: (paras ?? []).map((p) => ({
        kind: p.kind as "narration" | "dialogue",
        heNikud: p.he_nikud ?? "",
        hePlain: p.he_plain ?? "",
      })),
    };
  });

export const savePageParagraphs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      pageId: uuid,
      paragraphs: z.array(z.object({
        kind: z.enum(["narration", "dialogue"]),
        heNikud: z.string().max(20000),
        hePlain: z.string().max(20000),
      })).max(500),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: page } = await admin.from("book_pages").select("id").eq("id", data.pageId).maybeSingle();
    if (!page) throw new Error("PAGE_NOT_FOUND");
    const { data: before } = await admin.from("page_paragraphs").select("page_id, sort_order, kind, he_nikud, he_plain").eq("page_id", page.id);
    await admin.from("page_paragraphs").delete().eq("page_id", page.id);
    if (data.paragraphs.length) {
      const { error } = await admin.from("page_paragraphs").insert(
        data.paragraphs.map((p, i) => ({ page_id: page.id, sort_order: i + 1, kind: p.kind, he_nikud: nul(p.heNikud), he_plain: nul(p.hePlain) })),
      );
      if (error) {
        if (before?.length) await admin.from("page_paragraphs").insert(before);
        throw new Error("SAVE_FAILED");
      }
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

export const uploadPageAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("AUDIO_BAD_REQUEST");
    const pageId = String(data.get("pageId") ?? "");
    const file = data.get("file");
    if (!uuid.safeParse(pageId).success || !(file instanceof File)) throw new Error("AUDIO_BAD_REQUEST");
    return { pageId, file };
  })
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const ext = extensionAudio(data.file.name);
    if (!ext) throw new Error("AUDIO_BAD_FORMAT");
    if (data.file.size > MAX_AUDIO) throw new Error("AUDIO_TOO_BIG");
    const { data: page } = await admin.from("book_pages").select("id, book_id, page_no, audio_path").eq("id", data.pageId).maybeSingle();
    if (!page) throw new Error("PAGE_NOT_FOUND");
    const path = `${page.book_id}/page-${String(page.page_no).padStart(2, "0")}.${ext}`;
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const { error } = await admin.storage.from(AUDIO_BUCKET).upload(path, bytes, {
      upsert: true,
      contentType: ext === "mp3" ? "audio/mpeg" : "audio/mp4",
    });
    if (error) throw new Error(`AUDIO_UPLOAD_FAILED:${error.message}`);
    if (page.audio_path && page.audio_path !== path) await admin.storage.from(AUDIO_BUCKET).remove([page.audio_path]);
    await admin.from("book_pages").update({ audio_path: path }).eq("id", page.id);
    return { ok: true };
  });

export const removePageAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pageId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: page } = await admin.from("book_pages").select("id, audio_path").eq("id", data.pageId).maybeSingle();
    if (!page) throw new Error("PAGE_NOT_FOUND");
    if (page.audio_path) await admin.storage.from(AUDIO_BUCKET).remove([page.audio_path]);
    await admin.from("book_pages").update({ audio_path: null }).eq("id", page.id);
    return { ok: true };
  });

export const pageAudioUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pageId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: page } = await admin.from("book_pages").select("audio_path").eq("id", data.pageId).maybeSingle();
    if (!page?.audio_path) throw new Error("AUDIO_NONE");
    const { data: signed, error } = await admin.storage.from(AUDIO_BUCKET).createSignedUrl(page.audio_path, SIGNED_SECONDS);
    if (error || !signed) throw new Error("AUDIO_SIGN_FAILED");
    return { url: signed.signedUrl };
  });
