import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { texteErreurBase } from "./db-error";
import { analyserColle, natureDuBloc, parseColle } from "./coller-livre";

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
  editionFr: EditionEtat;
  editionEn: EditionEtat;
  glossaireFr: GlossaireFichier | null;
  glossaireEn: GlossaireFichier | null;
};

export const EDITION_ETATS = ["absente", "preparation", "publiee"] as const;
export type EditionEtat = (typeof EDITION_ETATS)[number];
export type GlossaireFichier = { path: string; name: string; updatedAt: string | null };

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
      editionFr: b.edition_fr as EditionEtat,
      editionEn: b.edition_en as EditionEtat,
      glossaireFr: await lireGlossaire(admin, b.glossaire_fr_path),
      glossaireEn: await lireGlossaire(admin, b.glossaire_en_path),
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
        titleFr: optText,
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

    // Le titre est obligatoire pour chaque édition qui n'est pas « absente ».
    const { data: etats } = await admin
      .from("books")
      .select("edition_fr, edition_en")
      .eq("id", data.id)
      .maybeSingle();
    if (etats?.edition_fr !== "absente" && !nullish(data.titleFr))
      throw new Error("TITLE_REQUIRED_FR");
    if (etats?.edition_en !== "absente" && !nullish(data.titleEn))
      throw new Error("TITLE_REQUIRED_EN");

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
        // title_fr est NOT NULL en base : une édition absente garde son ancien titre.
        ...(nullish(data.titleFr) ? { title_fr: nullish(data.titleFr)! } : {}),
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
  /** Au moins un paragraphe sans soutien (ou aucun paragraphe) dans cette langue. */
  supportMissingFr: boolean;
  supportMissingEn: boolean;
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
    const ids = (rows ?? []).map((r) => r.id);
    const blocks: { page_id: string; support_fr: string | null; support_en: string | null }[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: part } = await admin
        .from("page_blocks")
        .select("page_id, support_fr, support_en")
        .in("page_id", ids.slice(i, i + 200));
      blocks.push(...(part ?? []));
    }
    const vide = (v: string | null) => !v || v.trim().length === 0;
    const manque = (pageId: string, col: "support_fr" | "support_en") => {
      const own = blocks.filter((b) => b.page_id === pageId);
      return own.length === 0 || own.some((b) => vide(b[col]));
    };
    return (rows ?? []).map((r) => ({
      id: r.id,
      pageNo: r.page_no,
      chapterNo: r.chapter_no ?? null,
      supportKind: r.support_kind,
      hasAudio: Boolean(r.audio_path),
      isPublished: r.is_published,
      supportMissingFr: manque(r.id, "support_fr"),
      supportMissingEn: manque(r.id, "support_en"),
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
    if (error || !inserted) {
      // L'index unique de la base parle le même langage que le contrôle applicatif.
      if (error?.code === "23505") throw new Error("PAGE_NO_TAKEN");
      throw new Error(texteErreurBase("CREATE_REFUSED", error));
    }
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
        blockKind: (b.block_kind === "dialogue" ? "dialogue" : "narrative") as BlockKindValue,
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
              // Toute autre valeur est refusée ici, avant d'atteindre la base.
              blockKind: z.enum(BLOCK_KINDS),
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
        block_kind: b.blockKind,
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

/**
 * BRIQUE 8 — publier depuis le tableau. Écriture minimale : un identifiant, un
 * booléen. Ni blocs, ni autres colonnes ne sont touchés (à la différence de
 * `saveAtelierPage`, qui réécrit la page entière et ses paragraphes).
 */
export const setAtelierPagePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ pageId: z.string().uuid(), isPublished: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { error } = await admin
      .from("book_pages")
      .update({ is_published: data.isPublished })
      .eq("id", data.pageId);
    if (error) throw new Error(texteErreurBase("SAVE_REFUSED", error));
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

/* ————————————————— BRIQUE 7 : coller un livre entier ————————————————— */

/**
 * Les quatre valeurs que la contrainte `book_pages_support_kind_check` accepte
 * réellement en base, lues sur la contrainte elle-même :
 * CHECK (support_kind = ANY (ARRAY['translation','cloze','keys','nikud'])).
 */
export const SUPPORT_KINDS_BASE = ["translation", "cloze", "keys", "nikud"] as const;
export type SupportKindBase = (typeof SUPPORT_KINDS_BASE)[number];

export type ColleResultat = { pages: number; blocks: number };

/**
 * L'écriture d'un livre collé. Elle refait elle-même le découpage et
 * l'appariement : l'écran ne fait que montrer, le serveur seul décide.
 * Écriture par lots : une requête pour les pages, une requête pour les
 * paragraphes — pas une requête par paragraphe. Tout ou rien : si les
 * paragraphes échouent, les pages qui venaient d'être créées sont retirées.
 */
export const collerLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bookId: z.string().uuid(),
        nikud: z.string().max(500000),
        plain: z.string().max(500000),
        runningHeadFr: optText,
        runningHeadEn: optText,
        supportKind: z.enum(SUPPORT_KINDS_BASE),
        remplacer: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<ColleResultat> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: existantes } = await admin
      .from("book_pages")
      .select("id, page_no")
      .eq("book_id", data.bookId);
    const dejaLa = new Map((existantes ?? []).map((p) => [p.page_no, p.id]));

    const analyse = analyserColle(data.nikud, data.plain, [...dejaLa.keys()], data.remplacer);
    if (!analyse.ok) throw new Error("PASTE_INVALID");

    const gauche = new Map(parseColle(data.nikud).pages.map((p) => [p.pageNo, p]));
    const droite = new Map(parseColle(data.plain).pages.map((p) => [p.pageNo, p]));

    const reprises = analyse.lignes
      .filter((l) => l.verdict === "remplacement")
      .map((l) => dejaLa.get(l.pageNo)!)
      .filter(Boolean);
    const neuves = analyse.lignes.filter((l) => l.verdict === "ok");

    // Les pages reprises : les champs de tête suivent le formulaire, l'audio reste.
    for (const ligne of analyse.lignes.filter((l) => l.verdict === "remplacement")) {
      const { error } = await admin
        .from("book_pages")
        .update({
          chapter_no: ligne.chapterNo,
          folio: ligne.pageNo,
          support_kind: data.supportKind,
          running_head_fr: nullish(data.runningHeadFr),
          running_head_en: nullish(data.runningHeadEn),
        })
        .eq("id", dejaLa.get(ligne.pageNo)!);
      if (error) throw new Error(texteErreurBase("SAVE_REFUSED", error));
    }
    if (reprises.length > 0) {
      await admin.from("page_blocks").delete().in("page_id", reprises);
    }

    let creees: { id: string; page_no: number }[] = [];
    if (neuves.length > 0) {
      const { data: inserted, error } = await admin
        .from("book_pages")
        .insert(
          neuves.map((l) => ({
            book_id: data.bookId,
            page_no: l.pageNo,
            chapter_no: l.chapterNo,
            folio: l.pageNo,
            support_kind: data.supportKind,
            running_head_fr: nullish(data.runningHeadFr),
            running_head_en: nullish(data.runningHeadEn),
            is_published: false,
          })),
        )
        .select("id, page_no");
      if (error || !inserted) {
        if (error?.code === "23505") throw new Error("PAGE_NO_TAKEN");
        throw new Error(texteErreurBase("CREATE_REFUSED", error));
      }
      creees = inserted;
    }

    const idParPage = new Map<number, string>(dejaLa);
    for (const p of creees) idParPage.set(p.page_no, p.id);

    const blocs: {
      page_id: string;
      sort_order: number;
      block_kind: BlockKindValue;
      he_nikud: string;
      he_plain: string;
    }[] = [];
    for (const ligne of analyse.lignes) {
      const pageId = idParPage.get(ligne.pageNo)!;
      const g = gauche.get(ligne.pageNo)!;
      const d = droite.get(ligne.pageNo)!;
      for (let i = 0; i < g.paragraphs.length; i += 1) {
        blocs.push({
          page_id: pageId,
          sort_order: i + 1,
          block_kind: natureDuBloc(g.paragraphs[i]!),
          he_nikud: g.paragraphs[i]!,
          he_plain: d.paragraphs[i]!,
        });
      }
    }

    try {
      for (let i = 0; i < blocs.length; i += 500) {
        const { error } = await admin.from("page_blocks").insert(blocs.slice(i, i + 500));
        if (error) throw new Error(texteErreurBase("SAVE_REFUSED", error));
      }
    } catch (e) {
      // Tout ou rien : on retire ce que cette opération vient de créer.
      const ids = creees.map((p) => p.id);
      if (ids.length > 0) {
        await admin.from("page_blocks").delete().in("page_id", ids);
        await admin.from("book_pages").delete().in("id", ids);
      }
      throw e;
    }

    return { pages: analyse.lignes.length, blocks: blocs.length };
  });

/* ------------------------------------------------------------------------- *
 * DEUX ÉDITIONS PAR LIVRE — état, liste de contrôle, glossaire.
 * ------------------------------------------------------------------------- */

const GLOSSAIRE_BUCKET = "glossaires";
const MAX_GLOSSAIRE = 20 * 1024 * 1024;
const langue = z.enum(["fr", "en"]);

async function lireGlossaire(
  admin: Awaited<ReturnType<typeof getAdminClient>>,
  path: string | null,
): Promise<GlossaireFichier | null> {
  if (!path) return null;
  const dir = path.split("/").slice(0, -1).join("/");
  const name = path.split("/").pop() ?? path;
  const { data } = await admin.storage.from(GLOSSAIRE_BUCKET).list(dir);
  const f = (data ?? []).find((o) => o.name === name);
  return { path, name, updatedAt: f?.updated_at ?? f?.created_at ?? null };
}

export type ControleEdition = {
  bloquants: { code: string; n?: number }[];
  avertissements: { code: string }[];
};

async function controler(
  admin: Awaited<ReturnType<typeof getAdminClient>>,
  bookId: string,
  lang: "fr" | "en",
): Promise<ControleEdition> {
  const { data: b } = await admin.from("books").select("*").eq("id", bookId).maybeSingle();
  if (!b) throw new Error("BOOK_NOT_FOUND");
  const en = lang === "en";
  const vide = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");
  const bloquants: ControleEdition["bloquants"] = [];
  const avertissements: ControleEdition["avertissements"] = [];

  if (vide(en ? b.title_en : b.title_fr)) bloquants.push({ code: "title" });
  if (vide(en ? b.blurb_en : b.blurb_fr)) bloquants.push({ code: "blurb" });
  if (vide(en ? b.amazon_url_com : b.amazon_url_fr)) bloquants.push({ code: "amazon" });
  if (vide(en ? b.glossaire_en_path : b.glossaire_fr_path)) bloquants.push({ code: "glossary" });

  const { data: pages } = await admin
    .from("book_pages")
    .select("id, chapter_no, chapter_title_fr, chapter_title_en")
    .eq("book_id", bookId);
  const ids = (pages ?? []).map((p) => p.id);
  const blocks: { page_id: string; support_fr: string | null; support_en: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: part } = await admin
      .from("page_blocks")
      .select("page_id, support_fr, support_en")
      .in("page_id", ids.slice(i, i + 200));
    blocks.push(...(part ?? []));
  }
  const sansSoutien = ids.filter((id) => {
    const own = blocks.filter((x) => x.page_id === id);
    return own.length === 0 || own.some((x) => vide(en ? x.support_en : x.support_fr));
  }).length;
  if (sansSoutien > 0) bloquants.push({ code: "support", n: sansSoutien });

  const chapitres = new Map<number, boolean>();
  for (const p of pages ?? []) {
    if (p.chapter_no == null) continue;
    const ok = !vide(en ? p.chapter_title_en : p.chapter_title_fr);
    chapitres.set(p.chapter_no, (chapitres.get(p.chapter_no) ?? false) || ok);
  }
  const sansTitre = [...chapitres.values()].filter((ok) => !ok).length;
  if (sansTitre > 0) bloquants.push({ code: "chapterTitles", n: sansTitre });

  if (!b.collection_id) bloquants.push({ code: "collectionName" });
  else {
    const { data: c } = await admin
      .from("collections")
      .select("name_fr, name_en")
      .eq("id", b.collection_id)
      .maybeSingle();
    if (vide(en ? c?.name_en : c?.name_fr)) bloquants.push({ code: "collectionName" });
  }

  const { count } = await admin
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("book_id", bookId)
    .eq("lang", lang);
  if (!count) avertissements.push({ code: "quiz" });
  if (vide(en ? b.subtitle_en : b.subtitle_fr)) avertissements.push({ code: "subtitle" });
  const learn = en ? b.what_you_learn_en : b.what_you_learn_fr;
  if (!Array.isArray(learn) || learn.length === 0) avertissements.push({ code: "learn" });

  return { bloquants, avertissements };
}

export const controleEdition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bookId: z.string().uuid(), lang: langue }).parse(d))
  .handler(async ({ context, data }): Promise<ControleEdition> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    return controler(admin, data.bookId, data.lang);
  });

/** Changer l'état d'une édition. « publiée » exige une liste de contrôle vide. */
export const setEditionEtat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ bookId: z.string().uuid(), lang: langue, etat: z.enum(EDITION_ETATS) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data: b } = await admin
      .from("books")
      .select("edition_fr, edition_en, title_fr, title_en")
      .eq("id", data.bookId)
      .maybeSingle();
    if (!b) throw new Error("BOOK_NOT_FOUND");
    const autre = data.lang === "en" ? b.edition_fr : b.edition_en;
    if (data.etat === "absente" && autre === "absente") throw new Error("EDITION_ONE_REQUIRED");
    if (data.etat !== "absente") {
      const titre = data.lang === "en" ? b.title_en : b.title_fr;
      if (!titre || titre.trim() === "")
        throw new Error(data.lang === "en" ? "TITLE_REQUIRED_EN" : "TITLE_REQUIRED_FR");
    }
    if (data.etat === "publiee") {
      const c = await controler(admin, data.bookId, data.lang);
      if (c.bloquants.length > 0) throw new Error("EDITION_BLOCKED");
    }
    const col = data.lang === "en" ? "edition_en" : "edition_fr";
    const { error } = await admin
      .from("books")
      .update({ [col]: data.etat } as { edition_fr: EditionEtat })
      .eq("id", data.bookId);
    if (error) throw new Error(texteErreurBase("SAVE_REFUSED", error));
    return { ok: true };
  });

/** Le glossaire d'une édition : un PDF rangé sous <book_id>/<fr|en>/<nom>. */
export const uploadGlossaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("GLOSSARY_BAD_REQUEST");
    const bookId = String(data.get("bookId") ?? "");
    const lang = String(data.get("lang") ?? "");
    const file = data.get("file");
    if (!z.string().uuid().safeParse(bookId).success) throw new Error("GLOSSARY_BAD_REQUEST");
    if (lang !== "fr" && lang !== "en") throw new Error("GLOSSARY_BAD_REQUEST");
    if (!(file instanceof File)) throw new Error("GLOSSARY_BAD_REQUEST");
    return { bookId, lang: lang as "fr" | "en", file };
  })
  .handler(async ({ context, data }) => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    if (!data.file.name.toLowerCase().endsWith(".pdf")) throw new Error("GLOSSARY_BAD_FORMAT");
    if (data.file.size > MAX_GLOSSAIRE) throw new Error("GLOSSARY_TOO_BIG");
    const { data: b } = await admin
      .from("books")
      .select("glossaire_fr_path, glossaire_en_path")
      .eq("id", data.bookId)
      .maybeSingle();
    if (!b) throw new Error("BOOK_NOT_FOUND");
    const nom = data.file.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-120) || "glossaire.pdf";
    const path = `${data.bookId}/${data.lang}/${nom}`;
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const { error } = await admin.storage
      .from(GLOSSAIRE_BUCKET)
      .upload(path, bytes, { upsert: true, contentType: "application/pdf" });
    if (error) throw new Error(`GLOSSARY_UPLOAD_FAILED:${error.message}`);
    const ancien = data.lang === "en" ? b.glossaire_en_path : b.glossaire_fr_path;
    if (ancien && ancien !== path) await admin.storage.from(GLOSSAIRE_BUCKET).remove([ancien]);
    const col = data.lang === "en" ? "glossaire_en_path" : "glossaire_fr_path";
    await admin
      .from("books")
      .update({ [col]: path } as { glossaire_fr_path: string })
      .eq("id", data.bookId);
    return { ok: true, path };
  });

export const glossaireAtelierUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bookId: z.string().uuid(), lang: langue }).parse(d))
  .handler(async ({ context, data }) => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data: b } = await admin
      .from("books")
      .select("glossaire_fr_path, glossaire_en_path")
      .eq("id", data.bookId)
      .maybeSingle();
    const path = data.lang === "en" ? b?.glossaire_en_path : b?.glossaire_fr_path;
    if (!path) return { url: null as string | null };
    const { data: signed } = await admin.storage
      .from(GLOSSAIRE_BUCKET)
      .createSignedUrl(path, 120, { download: true });
    return { url: signed?.signedUrl ?? null };
  });
