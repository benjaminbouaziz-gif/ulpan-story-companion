import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { texteErreurBase } from "./db-error";

/**
 * BRIQUE 1 — L'ONGLET LIVRE.
 *
 * L'atelier n'est plus une chaîne de robots : c'est l'écran où le contenu se
 * saisit à la main. Toute lecture et toute écriture passent par ici :
 *  - `requireSupabaseAuth` exige un jeton porteur valide ;
 *  - `assertEditor` lit le rôle EN BASE (`user_roles`), jamais depuis le client ;
 *  - `getAdminClient` n'est atteignable qu'avec l'`EditorContext` produit par
 *    `assertEditor`.
 * Aucun contenu n'est écrit en dur : la base ne se remplit que par l'écran.
 */

const BUCKET = "audios-livres";
const SIGNED_SECONDS = 60;
export const SUPPORT_KINDS = ["translation", "cloze", "vocabulary", "nikud"] as const;
export type SupportKindValue = (typeof SUPPORT_KINDS)[number];

const optText = z.string().trim().max(20000).optional();

function nullish(value: string | undefined | null): string | null {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : null;
}

/** Une adresse d'achat est refusée si elle ne commence pas par https://. */
const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v.length === 0 || v.startsWith("https://"), "https")
  .optional();

export type AtelierLivreRow = {
  id: string;
  slug: string;
  title: string;
  tomeNo: number | null;
  collection: string | null;
  qrCode: string;
  status: string;
  pages: number;
  pagesWithAudio: number;
};

export const atelierLivres = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AtelierLivreRow[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const [books, collections, pages] = await Promise.all([
      admin
        .from("books")
        .select("id, slug, title_fr, tome_no, collection_id, qr_code, status")
        .order("tome_no", { ascending: true })
        .order("title_fr", { ascending: true }),
      admin.from("collections").select("id, name_fr"),
      admin.from("book_pages").select("book_id, audio_path"),
    ]);

    const names = new Map((collections.data ?? []).map((c) => [c.id, c.name_fr]));
    const pageRows = pages.data ?? [];

    return (books.data ?? []).map((b) => {
      const own = pageRows.filter((p) => p.book_id === b.id);
      return {
        id: b.id,
        slug: b.slug,
        title: b.title_fr,
        tomeNo: b.tome_no ?? null,
        collection: b.collection_id ? (names.get(b.collection_id) ?? null) : null,
        qrCode: b.qr_code,
        status: b.status as string,
        pages: own.length,
        pagesWithAudio: own.filter((p) => p.audio_path).length,
      };
    });
  });

export type AtelierLivreInfo = {
  id: string;
  slug: string;
  qrCode: string;
  tomeNo: number | null;
  collectionId: string | null;
  collectionName: string | null;
  titleFr: string;
  titleEn: string;
  titleHe: string;
  subtitleFr: string;
  subtitleEn: string;
  blurbFr: string;
  blurbEn: string;
  levelNoteFr: string;
  levelNoteEn: string;
  whatYouLearnFr: string[];
  whatYouLearnEn: string[];
  amazonUrlFr: string;
  amazonUrlCom: string;
  amazonUrlOther: string;
  amazonAsin: string;
  coverUrl: string;
  samplePdfUrl: string;
  pageCount: number | null;
  chaptersCount: number | null;
  status: string;
  publishedAt: string | null;
};

function lines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export const atelierLivreInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ context, data }): Promise<AtelierLivreInfo | null> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: b } = await admin.from("books").select("*").eq("slug", data.slug).maybeSingle();
    if (!b) return null;

    const { data: collection } = b.collection_id
      ? await admin.from("collections").select("name_fr").eq("id", b.collection_id).maybeSingle()
      : { data: null };

    return {
      id: b.id,
      slug: b.slug,
      qrCode: b.qr_code,
      tomeNo: b.tome_no ?? null,
      collectionId: b.collection_id ?? null,
      collectionName: (collection as { name_fr: string } | null)?.name_fr ?? null,
      titleFr: b.title_fr ?? "",
      titleEn: b.title_en ?? "",
      titleHe: b.title_he ?? "",
      subtitleFr: b.subtitle_fr ?? "",
      subtitleEn: b.subtitle_en ?? "",
      blurbFr: b.blurb_fr ?? "",
      blurbEn: b.blurb_en ?? "",
      levelNoteFr: b.level_note_fr ?? "",
      levelNoteEn: b.level_note_en ?? "",
      whatYouLearnFr: lines(b.what_you_learn_fr),
      whatYouLearnEn: lines(b.what_you_learn_en),
      amazonUrlFr: b.amazon_url_fr ?? "",
      amazonUrlCom: b.amazon_url_com ?? "",
      amazonUrlOther: b.amazon_url_other ?? "",
      amazonAsin: b.amazon_asin ?? "",
      coverUrl: b.cover_url ?? "",
      samplePdfUrl: b.sample_pdf_url ?? "",
      pageCount: b.page_count ?? null,
      chaptersCount: b.chapters_count ?? null,
      status: b.status as string,
      publishedAt: b.published_at ?? null,
    };
  });

const STATUSES = [
  "idea",
  "writing",
  "vocalizing",
  "proofreading",
  "layout",
  "bat_ok",
  "printing",
  "published",
  "retired",
] as const;

export const saveAtelierLivreInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        titleFr: z.string().trim().min(1).max(300),
        titleEn: optText,
        titleHe: optText,
        subtitleFr: optText,
        subtitleEn: optText,
        slug: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .regex(/^[a-z0-9-]+$/, "slug"),
        tomeNo: z.number().int().min(1).max(999).nullable(),
        collectionId: z.string().uuid().nullable(),
        qrCode: z
          .string()
          .trim()
          .transform((v) => v.toUpperCase())
          .refine((v) => /^[A-Z0-9]{3,8}$/.test(v), "qr"),
        blurbFr: optText,
        blurbEn: optText,
        levelNoteFr: optText,
        levelNoteEn: optText,
        whatYouLearnFr: z.array(z.string().trim().max(500)).max(50),
        whatYouLearnEn: z.array(z.string().trim().max(500)).max(50),
        amazonUrlFr: httpsUrl,
        amazonUrlCom: httpsUrl,
        amazonUrlOther: httpsUrl,
        amazonAsin: optText,
        coverUrl: optText,
        samplePdfUrl: optText,
        pageCount: z.number().int().min(0).max(5000).nullable(),
        chaptersCount: z.number().int().min(0).max(500).nullable(),
        status: z.enum(STATUSES),
        publishedAt: z.string().trim().max(40).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; slug: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: taken } = await admin
      .from("books")
      .select("id")
      .eq("qr_code", data.qrCode)
      .neq("id", data.id)
      .maybeSingle();
    if (taken) throw new Error(`QR_TAKEN:${data.qrCode}`);

    const { data: slugTaken } = await admin
      .from("books")
      .select("id")
      .eq("slug", data.slug)
      .neq("id", data.id)
      .maybeSingle();
    if (slugTaken) throw new Error(`SLUG_TAKEN:${data.slug}`);

    const { error } = await admin
      .from("books")
      .update({
        title_fr: data.titleFr,
        title_en: nullish(data.titleEn),
        title_he: nullish(data.titleHe),
        subtitle_fr: nullish(data.subtitleFr),
        subtitle_en: nullish(data.subtitleEn),
        slug: data.slug,
        tome_no: data.tomeNo,
        collection_id: data.collectionId,
        qr_code: data.qrCode,
        blurb_fr: nullish(data.blurbFr),
        blurb_en: nullish(data.blurbEn),
        level_note_fr: nullish(data.levelNoteFr),
        level_note_en: nullish(data.levelNoteEn),
        what_you_learn_fr: data.whatYouLearnFr.filter((l) => l.length > 0),
        what_you_learn_en: data.whatYouLearnEn.filter((l) => l.length > 0),
        amazon_url_fr: nullish(data.amazonUrlFr),
        amazon_url_com: nullish(data.amazonUrlCom),
        amazon_url_other: nullish(data.amazonUrlOther),
        amazon_asin: nullish(data.amazonAsin),
        cover_url: nullish(data.coverUrl),
        sample_pdf_url: nullish(data.samplePdfUrl),
        page_count: data.pageCount,
        chapters_count: data.chaptersCount,
        status: data.status,
        published_at: nullish(data.publishedAt),
      })
      .eq("id", data.id);
    if (error) throw new Error(texteErreurBase("SAVE_REFUSED", error));

    return { ok: true, slug: data.slug };
  });

export type AtelierPageRow = {
  id: string;
  pageNo: number;
  chapterNo: number | null;
  supportKind: string;
  hasAudio: boolean;
  isPublished: boolean;
};

export const atelierLivrePages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<AtelierPageRow[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data: rows } = await admin
      .from("book_pages")
      .select("id, page_no, chapter_no, support_kind, audio_path, is_published")
      .eq("book_id", data.bookId)
      .order("page_no", { ascending: true });
    return (rows ?? []).map((r) => ({
      id: r.id,
      pageNo: r.page_no,
      chapterNo: r.chapter_no ?? null,
      supportKind: r.support_kind,
      hasAudio: Boolean(r.audio_path),
      isPublished: r.is_published,
    }));
  });

/**
 * La base n'accepte que ces deux natures de bloc : un paragraphe de récit et
 * une réplique de dialogue. La composition imprimée les distingue.
 */
export const BLOCK_KINDS = ["narrative", "dialogue"] as const;
export type BlockKindValue = (typeof BLOCK_KINDS)[number];

export type AtelierBlock = {
  id: string | null;
  sortOrder: number;
  blockKind: BlockKindValue;
  heNikud: string;
  hePlain: string;
  supportFr: string;
  supportEn: string;
};

export type AtelierPageDetail = {
  id: string;
  bookId: string;
  bookSlug: string;
  pageNo: number;
  chapterNo: number | null;
  supportKind: string;
  chapterTitleHe: string;
  chapterTitleFr: string;
  chapterTitleEn: string;
  runningHeadFr: string;
  runningHeadEn: string;
  folio: number | null;
  isPublished: boolean;
  audioPath: string | null;
  blocks: AtelierBlock[];
};

/** Une page vierge : on crée d'abord la ligne, on la remplit ensuite. */
export const createAtelierPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: last } = await admin
      .from("book_pages")
      .select("page_no")
      .eq("book_id", data.bookId)
      .order("page_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: inserted, error } = await admin
      .from("book_pages")
      .insert({
        book_id: data.bookId,
        page_no: (last?.page_no ?? 0) + 1,
        support_kind: "translation",
        is_published: false,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(texteErreurBase("CREATE_REFUSED", error));
    return { id: inserted.id };
  });

export const atelierPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ pageId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<AtelierPageDetail | null> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: page } = await admin
      .from("book_pages")
      .select("*")
      .eq("id", data.pageId)
      .maybeSingle();
    if (!page) return null;

    const [book, blocks] = await Promise.all([
      admin.from("books").select("slug").eq("id", page.book_id).maybeSingle(),
      admin
        .from("page_blocks")
        .select("id, sort_order, block_kind, he_nikud, he_plain, support_fr, support_en")
        .eq("page_id", page.id)
        .order("sort_order", { ascending: true }),
    ]);

    return {
      id: page.id,
      bookId: page.book_id,
      bookSlug: (book.data as { slug: string } | null)?.slug ?? "",
      pageNo: page.page_no,
      chapterNo: page.chapter_no ?? null,
      supportKind: page.support_kind,
      chapterTitleHe: page.chapter_title_he ?? "",
      chapterTitleFr: page.chapter_title_fr ?? "",
      chapterTitleEn: page.chapter_title_en ?? "",
      runningHeadFr: page.running_head_fr ?? "",
      runningHeadEn: page.running_head_en ?? "",
      folio: page.folio ?? null,
      isPublished: page.is_published,
      audioPath: page.audio_path ?? null,
      blocks: (blocks.data ?? []).map((b) => ({
        id: b.id,
        sortOrder: b.sort_order,
        heNikud: b.he_nikud ?? "",
        hePlain: b.he_plain ?? "",
        supportFr: b.support_fr ?? "",
        supportEn: b.support_en ?? "",
      })),
    };
  });

export const saveAtelierPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        pageId: z.string().uuid(),
        pageNo: z.number().int().min(1).max(2000),
        chapterNo: z.number().int().min(1).max(500).nullable(),
        supportKind: z.enum(SUPPORT_KINDS),
        chapterTitleHe: optText,
        chapterTitleFr: optText,
        chapterTitleEn: optText,
        runningHeadFr: optText,
        runningHeadEn: optText,
        folio: z.number().int().min(0).max(2000).nullable(),
        isPublished: z.boolean(),
        blocks: z
          .array(
            z.object({
              id: z.string().uuid().nullable(),
              heNikud: z.string().max(20000),
              hePlain: z.string().max(20000),
              supportFr: z.string().max(20000),
              supportEn: z.string().max(20000),
            }),
          )
          .max(60),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: page } = await admin
      .from("book_pages")
      .select("id, book_id, page_no")
      .eq("id", data.pageId)
      .maybeSingle();
    if (!page) throw new Error("PAGE_NOT_FOUND");

    if (data.pageNo !== page.page_no) {
      const { data: clash } = await admin
        .from("book_pages")
        .select("id")
        .eq("book_id", page.book_id)
        .eq("page_no", data.pageNo)
        .neq("id", page.id)
        .maybeSingle();
      if (clash) throw new Error(`PAGE_NO_TAKEN:${data.pageNo}`);
    }

    const { error: pageError } = await admin
      .from("book_pages")
      .update({
        page_no: data.pageNo,
        chapter_no: data.chapterNo,
        support_kind: data.supportKind,
        chapter_title_he: nullish(data.chapterTitleHe),
        chapter_title_fr: nullish(data.chapterTitleFr),
        chapter_title_en: nullish(data.chapterTitleEn),
        running_head_fr: nullish(data.runningHeadFr),
        running_head_en: nullish(data.runningHeadEn),
        folio: data.folio,
        is_published: data.isPublished,
      })
      .eq("id", page.id);
    if (pageError) {
      if (pageError.code === "23505") throw new Error(`PAGE_NO_TAKEN:${data.pageNo}`);
      throw new Error(texteErreurBase("SAVE_REFUSED", pageError));
    }

    // Les blocs : on écrit l'ordre affiché, on retire ceux que l'écran a enlevés.
    const kept = data.blocks.map((b) => b.id).filter((id): id is string => Boolean(id));
    const { data: existing } = await admin.from("page_blocks").select("id").eq("page_id", page.id);
    const toDelete = (existing ?? []).map((b) => b.id).filter((id) => !kept.includes(id));
    if (toDelete.length > 0) {
      await admin.from("page_blocks").delete().in("id", toDelete);
    }

    for (let i = 0; i < data.blocks.length; i += 1) {
      const b = data.blocks[i]!;
      const row = {
        page_id: page.id,
        sort_order: i + 1,
        // La base n'accepte que 'narrative' ou 'dialogue' : le paragraphe est
        // 'narrative', et cette brique n'offre pas d'autre choix.
        block_kind: "narrative",
        he_nikud: nullish(b.heNikud),
        he_plain: nullish(b.hePlain),
        support_fr: nullish(b.supportFr),
        support_en: nullish(b.supportEn),
      };
      const { error } = b.id
        ? await admin.from("page_blocks").update(row).eq("id", b.id)
        : await admin.from("page_blocks").insert(row);
      if (error) throw new Error(texteErreurBase("SAVE_REFUSED", error));
    }

    return { ok: true };
  });

export const deleteAtelierPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ pageId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: page } = await admin
      .from("book_pages")
      .select("id, audio_path")
      .eq("id", data.pageId)
      .maybeSingle();
    if (!page) throw new Error("PAGE_NOT_FOUND");

    if (page.audio_path) await admin.storage.from(BUCKET).remove([page.audio_path]);
    await admin.from("page_blocks").delete().eq("page_id", page.id);
    const { error } = await admin.from("book_pages").delete().eq("id", page.id);
    if (error) throw new Error(texteErreurBase("DELETE_REFUSED", error));
    return { ok: true };
  });

/* ————————————————— L'audio de la page ————————————————— */

const MAX_AUDIO = 50 * 1024 * 1024;

/**
 * Téléversement : le nom d'origine est jeté, le chemin est imposé
 * `{slug}/page-{NN}.{ext}`. Le fichier arrive en FormData, jamais en base64.
 */
export const uploadAtelierPageAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("AUDIO_BAD_REQUEST");
    const pageId = String(data.get("pageId") ?? "");
    const file = data.get("file");
    if (!z.string().uuid().safeParse(pageId).success) throw new Error("AUDIO_BAD_REQUEST");
    if (!(file instanceof File)) throw new Error("AUDIO_BAD_REQUEST");
    return { pageId, file };
  })
  .handler(async ({ context, data }): Promise<{ ok: true; path: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const ext = data.file.name.toLowerCase().endsWith(".mp3")
      ? "mp3"
      : data.file.name.toLowerCase().endsWith(".m4a")
        ? "m4a"
        : null;
    if (!ext) throw new Error("AUDIO_BAD_FORMAT");
    if (data.file.size > MAX_AUDIO) throw new Error("AUDIO_TOO_BIG");

    const { data: page } = await admin
      .from("book_pages")
      .select("id, book_id, page_no, audio_path")
      .eq("id", data.pageId)
      .maybeSingle();
    if (!page) throw new Error("PAGE_NOT_FOUND");

    const { data: book } = await admin
      .from("books")
      .select("slug")
      .eq("id", page.book_id)
      .maybeSingle();
    if (!book) throw new Error("PAGE_NOT_FOUND");
    const path = `${book.slug}/page-${String(page.page_no).padStart(2, "0")}.${ext}`;

    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      upsert: true,
      contentType: ext === "mp3" ? "audio/mpeg" : "audio/mp4",
    });
    if (error) throw new Error(`AUDIO_UPLOAD_FAILED:${error.message}`);

    // Un changement d'extension laisserait un orphelin : on l'efface.
    if (page.audio_path && page.audio_path !== path) {
      await admin.storage.from(BUCKET).remove([page.audio_path]);
    }

    await admin.from("book_pages").update({ audio_path: path }).eq("id", page.id);
    return { ok: true, path };
  });

export const removeAtelierPageAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ pageId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: page } = await admin
      .from("book_pages")
      .select("id, audio_path")
      .eq("id", data.pageId)
      .maybeSingle();
    if (!page) throw new Error("PAGE_NOT_FOUND");
    if (page.audio_path) await admin.storage.from(BUCKET).remove([page.audio_path]);
    await admin.from("book_pages").update({ audio_path: null }).eq("id", page.id);
    return { ok: true };
  });

/** Lien de contrôle : signé à la demande, valable 60 secondes, jamais stocké. */
export const atelierPageAudioUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ pageId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ url: string | null }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: page } = await admin
      .from("book_pages")
      .select("audio_path")
      .eq("id", data.pageId)
      .maybeSingle();
    if (!page?.audio_path) return { url: null };

    const { data: signed, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(page.audio_path, SIGNED_SECONDS);
    if (error || !signed) return { url: null };
    return { url: signed.signedUrl };
  });

export type CollectionChoice = { id: string; nameFr: string };

export const atelierLivreCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CollectionChoice[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data } = await admin
      .from("collections")
      .select("id, name_fr, sort_order")
      .order("sort_order", { ascending: true });
    return (data ?? []).map((c) => ({ id: c.id, nameFr: c.name_fr }));
  });
