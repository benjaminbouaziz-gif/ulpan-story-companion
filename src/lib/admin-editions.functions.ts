import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyserQuizJson, exporterQuizJson } from "@/lib/quiz-json";

/**
 * ADMIN — une édition (FR ou EN) d'un livre. Même composant pour les deux
 * langues. Chaîne : requireSupabaseAuth → assertEditor → getAdminClient.
 * Aucun repli d'une langue sur l'autre : chaque requête filtre sur edition_id.
 */
const SITE = "site";
const GLOSS = "glossaires";
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_PDF = 20 * 1024 * 1024;
const IMAGE_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

async function editorAdmin(context: { supabase: Parameters<typeof import("@/lib/editor-context.server").assertEditor>[0]; userId: string }) {
  const { assertEditor } = await import("@/lib/editor-context.server");
  const { getAdminClient } = await import("@/lib/supabase-admin.server");
  return getAdminClient(await assertEditor(context.supabase, context.userId));
}
type Admin = Awaited<ReturnType<typeof editorAdmin>>;

const uuid = z.string().uuid();
const nul = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

async function editionEtLivre(admin: Admin, editionId: string) {
  const { data: ed } = await admin.from("book_editions").select("*").eq("id", editionId).maybeSingle();
  if (!ed) throw new Error("EDITION_NOT_FOUND");
  const { data: book } = await admin.from("books").select("*").eq("id", ed.book_id).single();
  if (!book) throw new Error("BOOK_NOT_FOUND");
  return { ed, book };
}

async function pagesDuLivre(admin: Admin, bookId: string) {
  const { data } = await admin.from("book_pages").select("page_no, chapter_no, is_published, audio_path").eq("book_id", bookId);
  return data ?? [];
}

/* ------------------------------------------------------------------ */
/* Contrôle avant publication (écran ET serveur)                       */
/* ------------------------------------------------------------------ */

export type Controle = { bloquants: string[]; avertissements: string[] };

async function controler(admin: Admin, editionId: string): Promise<Controle> {
  const { ed, book } = await editionEtLivre(admin, editionId);
  const pages = await pagesDuLivre(admin, book.id);
  const [{ data: titres }, { count: nQuiz }, { data: col }] = await Promise.all([
    admin.from("edition_chapter_titles").select("chapter_no, title").eq("edition_id", ed.id),
    admin.from("quiz_questions").select("id", { count: "exact", head: true }).eq("edition_id", ed.id),
    book.collection_id
      ? admin.from("collections").select("is_visible").eq("id", book.collection_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const b: string[] = [];
  const w: string[] = [];
  if (!book.collection_id) b.push("Le livre n'a pas de collection (onglet « Livre »).");
  if (!nul(ed.title)) b.push("Titre manquant.");
  if (!nul(ed.blurb)) b.push("Résumé manquant.");
  if (!ed.cover_path) b.push("Couverture manquante.");
  if (!nul(ed.amazon_url)) b.push("Lien Amazon manquant.");
  if (!ed.glossary_path) b.push("Glossaire manquant.");
  const chapitres = [...new Set(pages.map((p) => p.chapter_no))].sort((x, y) => x - y);
  const sansTitre = chapitres.filter((n) => !nul(titres?.find((t) => t.chapter_no === n)?.title));
  if (sansTitre.length) b.push(`Titre de chapitre manquant : ${sansTitre.join(", ")}.`);
  const publiees = pages.filter((p) => p.is_published);
  if (!publiees.length) b.push("Aucune page publiée.");
  if (!nQuiz) w.push("Le quiz est vide.");
  if (!ed.excerpt_path) w.push("Pas d'extrait.");
  const sansAudio = publiees.filter((p) => !p.audio_path).length;
  if (sansAudio) w.push(`${sansAudio} page(s) publiée(s) sans audio.`);
  if (col && !col.is_visible) w.push("Collection masquée : la page ne sera pas visible tant que la collection est masquée.");
  return { bloquants: b, avertissements: w };
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

export const adminEdition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ editionId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { ed, book } = await editionEtLivre(admin, data.editionId);
    const pages = await pagesDuLivre(admin, book.id);
    const [{ data: titres }, { data: hebreux }] = await Promise.all([
      admin.from("edition_chapter_titles").select("chapter_no, title").eq("edition_id", ed.id),
      admin.from("book_chapters").select("chapter_no, title_he").eq("book_id", book.id),
    ]);
    const chapitres = [...new Set(pages.map((p) => p.chapter_no))].sort((x, y) => x - y);
    const pub = (p: string | null) => (p ? `${admin.storage.from(SITE).getPublicUrl(p).data.publicUrl}?v=${encodeURIComponent(ed.updated_at)}` : null);
    let glossaire: { name: string; size: number | null; updatedAt: string | null } | null = null;
    if (ed.glossary_path) {
      const dir = ed.glossary_path.split("/").slice(0, -1).join("/");
      const name = ed.glossary_path.split("/").pop()!;
      const { data: list } = await admin.storage.from(GLOSS).list(dir, { search: name });
      const f = list?.find((x) => x.name === name);
      glossaire = { name, size: (f?.metadata as { size?: number } | null)?.size ?? null, updatedAt: f?.updated_at ?? f?.created_at ?? null };
    }
    return {
      edition: {
        id: ed.id,
        lang: ed.lang as "fr" | "en",
        status: ed.status as "preparation" | "publiee",
        publishedAt: ed.published_at,
        title: ed.title ?? "",
        subtitle: ed.subtitle ?? "",
        blurb: ed.blurb ?? "",
        levelNote: ed.level_note ?? "",
        learnItems: ed.learn_items ?? [],
        printPageCount: ed.print_page_count,
        amazonUrl: ed.amazon_url ?? "",
        coverUrl: pub(ed.cover_path),
        excerptUrl: pub(ed.excerpt_path),
        qrDownloadedAt: ed.qr_downloaded_at,
      },
      book: { id: book.id, slug: book.slug },
      chapitres: chapitres.map((n) => ({
        chapterNo: n,
        titleHe: hebreux?.find((h) => h.chapter_no === n)?.title_he ?? "",
        title: titres?.find((t) => t.chapter_no === n)?.title ?? "",
      })),
      pages: pages.map((p) => ({ page_no: p.page_no, chapter_no: p.chapter_no })),
      glossaire,
      controle: await controler(admin, ed.id),
    };
  });

/* ------------------------------------------------------------------ */
/* Vitrine                                                             */
/* ------------------------------------------------------------------ */

export const saveVitrine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      editionId: uuid,
      title: z.string().max(300),
      subtitle: z.string().max(300),
      blurb: z.string().max(5000),
      levelNote: z.string().max(500),
      learnItems: z.array(z.string().max(500)).max(50),
      printPageCount: z.number().int().min(1).max(10000).nullable(),
      amazonUrl: z.string().max(1000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const url = nul(data.amazonUrl);
    if (url && !/^https:\/\/\S+$/.test(url)) throw new Error("AMAZON_URL");
    const { error } = await admin
      .from("book_editions")
      .update({
        title: nul(data.title),
        subtitle: nul(data.subtitle),
        blurb: nul(data.blurb),
        level_note: nul(data.levelNote),
        learn_items: data.learnItems.map((l) => l.trim()).filter(Boolean),
        print_page_count: data.printPageCount,
        amazon_url: url,
      })
      .eq("id", data.editionId);
    if (error) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

function formEdition(d: FormData) {
  if (!(d instanceof FormData)) throw new Error("BAD_REQUEST");
  const editionId = String(d.get("editionId") ?? "");
  const file = d.get("file");
  if (!uuid.safeParse(editionId).success || !(file instanceof File)) throw new Error("BAD_REQUEST");
  return { editionId, kind: String(d.get("kind") ?? ""), file };
}

export const uploadEditionImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: FormData) => formEdition(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    if (data.kind !== "cover" && data.kind !== "excerpt") throw new Error("BAD_REQUEST");
    const ext = data.file.name.toLowerCase().split(".").pop() ?? "";
    const type = IMAGE_EXT[ext];
    if (!type) throw new Error("IMAGE_BAD_FORMAT");
    if (data.file.size > MAX_IMAGE) throw new Error("IMAGE_TOO_BIG");
    const { ed } = await editionEtLivre(admin, data.editionId);
    const col = data.kind === "cover" ? "cover_path" : "excerpt_path";
    const path = `${data.kind === "cover" ? "covers" : "excerpts"}/${ed.id}.${ext === "jpeg" ? "jpg" : ext}`;
    const { error } = await admin.storage.from(SITE).upload(path, new Uint8Array(await data.file.arrayBuffer()), { upsert: true, contentType: type });
    if (error) throw new Error("UPLOAD_FAILED");
    const ancien = ed[col];
    if (ancien && ancien !== path) await admin.storage.from(SITE).remove([ancien]);
    const { error: e2 } = await admin.from("book_editions").update({ [col]: path } as { cover_path: string }).eq("id", ed.id);
    if (e2) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

export const removeEditionImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ editionId: uuid, kind: z.enum(["cover", "excerpt"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { ed } = await editionEtLivre(admin, data.editionId);
    const col = data.kind === "cover" ? "cover_path" : "excerpt_path";
    const path = ed[col];
    const { error } = await admin.from("book_editions").update({ [col]: null } as { cover_path: null }).eq("id", ed.id);
    if (error) throw new Error("SAVE_FAILED");
    if (path) await admin.storage.from(SITE).remove([path]);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Titres de chapitre                                                  */
/* ------------------------------------------------------------------ */

export const saveEditionChapterTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ editionId: uuid, titles: z.array(z.object({ chapterNo: z.number().int().min(0).max(10000), title: z.string().max(500) })).max(1000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    if (!data.titles.length) return { ok: true };
    const { error } = await admin.from("edition_chapter_titles").upsert(
      data.titles.map((t) => ({ edition_id: data.editionId, chapter_no: t.chapterNo, title: nul(t.title) })),
      { onConflict: "edition_id,chapter_no" },
    );
    if (error) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* QR                                                                  */
/* ------------------------------------------------------------------ */

export const markQrDownloaded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ editionId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { ed, book } = await editionEtLivre(admin, data.editionId);
    const now = new Date().toISOString();
    if (!ed.qr_downloaded_at) await admin.from("book_editions").update({ qr_downloaded_at: now }).eq("id", ed.id);
    if (!book.slug_locked_at) await admin.from("books").update({ slug_locked_at: now }).eq("id", book.id);
    return { qrDownloadedAt: ed.qr_downloaded_at ?? now };
  });

/* ------------------------------------------------------------------ */
/* Quiz                                                                */
/* ------------------------------------------------------------------ */

async function quizDeLedition(admin: Admin, editionId: string) {
  const { data } = await admin
    .from("quiz_questions")
    .select("id, chapter_no, page_no, kind, question, hebrew, options, answer_index, explanation, sort_order")
    .eq("edition_id", editionId)
    .order("sort_order");
  return data ?? [];
}

export const quizEdition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ editionId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { ed, book } = await editionEtLivre(admin, data.editionId);
    const qs = await quizDeLedition(admin, ed.id);
    const ids = qs.map((q) => q.id);
    const answers: { question_id: string; is_correct: boolean }[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: part } = await admin.from("quiz_answers").select("question_id, is_correct").in("question_id", ids.slice(i, i + 200));
      answers.push(...(part ?? []));
    }
    const parQ = new Map<string, { n: number; ok: number }>();
    for (const a of answers) {
      const s = parQ.get(a.question_id) ?? { n: 0, ok: 0 };
      s.n++;
      if (a.is_correct) s.ok++;
      parQ.set(a.question_id, s);
    }
    const chap = new Map<number, { questions: number; reponses: number; justes: number }>();
    for (const q of qs) {
      const c = chap.get(q.chapter_no) ?? { questions: 0, reponses: 0, justes: 0 };
      const s = parQ.get(q.id);
      c.questions++;
      c.reponses += s?.n ?? 0;
      c.justes += s?.ok ?? 0;
      chap.set(q.chapter_no, c);
    }
    let pire: { question: string; chapitre: number; taux: number; reponses: number } | null = null;
    for (const q of qs) {
      const s = parQ.get(q.id);
      if (!s?.n) continue;
      const taux = s.ok / s.n;
      if (!pire || taux < pire.taux) pire = { question: q.question, chapitre: q.chapter_no, taux, reponses: s.n };
    }
    return {
      total: qs.length,
      chapitres: [...chap.entries()].sort((a, b) => a[0] - b[0]).map(([chapitre, c]) => ({ chapitre, ...c, taux: c.reponses ? c.justes / c.reponses : null })),
      pire,
      json: exporterQuizJson(book.slug, qs, ed.lang as "fr" | "en"),
    };
  });

const quizInput = z.object({ editionId: uuid, contenu: z.string().max(2_000_000) });

async function analyserServeur(admin: Admin, editionId: string, contenu: string) {
  const { ed, book } = await editionEtLivre(admin, editionId);
  const pages = await pagesDuLivre(admin, book.id);
  return analyserQuizJson(contenu, book.slug, pages, ed.lang as "fr" | "en");
}

export const analyserQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => quizInput.parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const a = await analyserServeur(admin, data.editionId, data.contenu);
    return { erreurs: a.erreurs, avertissements: a.avertissements, resume: a.resume };
  });

export const remplacerQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => quizInput.parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const a = await analyserServeur(admin, data.editionId, data.contenu);
    if (a.erreurs.length) throw new Error("QUIZ_INVALID");
    const { data: n, error } = await admin.rpc("remplacer_quiz_edition", { p_edition_id: data.editionId, p_rows: a.lignes });
    if (error) throw new Error("SAVE_FAILED");
    return { inserted: n ?? a.lignes.length };
  });

/* ------------------------------------------------------------------ */
/* Glossaire                                                           */
/* ------------------------------------------------------------------ */

export const uploadGlossaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: FormData) => formEdition(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    if (!data.file.name.toLowerCase().endsWith(".pdf")) throw new Error("GLOSSARY_BAD_FORMAT");
    if (data.file.size > MAX_PDF) throw new Error("GLOSSARY_TOO_BIG");
    const { ed } = await editionEtLivre(admin, data.editionId);
    const nom = data.file.name.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(-100) || "glossaire";
    const path = `${ed.id}/${nom}.pdf`;
    const { error } = await admin.storage.from(GLOSS).upload(path, new Uint8Array(await data.file.arrayBuffer()), { upsert: true, contentType: "application/pdf" });
    if (error) throw new Error("UPLOAD_FAILED");
    if (ed.glossary_path && ed.glossary_path !== path) await admin.storage.from(GLOSS).remove([ed.glossary_path]);
    const { error: e2 } = await admin.from("book_editions").update({ glossary_path: path }).eq("id", ed.id);
    if (e2) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

export const removeGlossaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ editionId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { ed } = await editionEtLivre(admin, data.editionId);
    const { error } = await admin.from("book_editions").update({ glossary_path: null }).eq("id", ed.id);
    if (error) throw new Error("SAVE_FAILED");
    if (ed.glossary_path) await admin.storage.from(GLOSS).remove([ed.glossary_path]);
    return { ok: true };
  });

export const glossaireUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ editionId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { ed } = await editionEtLivre(admin, data.editionId);
    if (!ed.glossary_path) throw new Error("GLOSSARY_MISSING");
    const { data: s, error } = await admin.storage.from(GLOSS).createSignedUrl(ed.glossary_path, 300, { download: true });
    if (error || !s) throw new Error("SAVE_FAILED");
    return { url: s.signedUrl };
  });

/* ------------------------------------------------------------------ */
/* Publication                                                         */
/* ------------------------------------------------------------------ */

export const setEditionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ editionId: uuid, status: z.enum(["preparation", "publiee"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    if (data.status === "publiee") {
      const c = await controler(admin, data.editionId);
      if (c.bloquants.length) throw new Error(`EDITION_BLOCKED:${c.bloquants.join(" ")}`);
    }
    const { error } = await admin
      .from("book_editions")
      .update(data.status === "publiee" ? { status: "publiee", published_at: new Date().toISOString() } : { status: "preparation", published_at: null })
      .eq("id", data.editionId);
    if (error) throw new Error("SAVE_FAILED");
    return { ok: true };
  });
