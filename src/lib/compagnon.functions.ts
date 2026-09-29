import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { QuizQuestion, LastAnswer } from "@/lib/quiz-types";

/**
 * Le compagnon d'un livre. Chaque fonction vérifie l'accès : utilisateur
 * connecté + edition_access vers l'édition de la langue du domaine + publiée +
 * collection visible. Les lectures de contenu passent par le client de
 * l'utilisateur (RLS) ; écritures et liens signés par public-writes.server.ts,
 * qui refait la vérification.
 */
type Lang = "fr" | "en";
type Sb = import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;

export type CompagnonParagraph = { id: string; kind: "narration" | "dialogue"; he_nikud: string | null; he_plain: string | null };
export type CompagnonPage = { id: string; page_no: number; chapter_no: number; has_audio: boolean; paragraphs: CompagnonParagraph[] };
export type CompagnonChapter = { chapter_no: number; title_he: string | null; title: string | null; pages: number[]; first_page: number | null; last_page: number | null };

const slug = z.string().trim().min(1).max(80);
const pw = () => import("@/lib/public-writes.server");
async function langDuDomaine(): Promise<Lang> {
  const { requestLang } = await import("@/i18n/lang.server");
  return requestLang().lang;
}

/** Édition de la langue du domaine, si l'utilisateur y a accès (lecture sous RLS). */
async function editionAccessible(sb: Sb, userId: string, bookSlug: string, lang: Lang) {
  const { data: book } = await sb.from("books").select("id, title_he, collection_id").eq("slug", bookSlug).maybeSingle();
  if (!book) return null;
  const { data: ed } = await sb.from("book_editions").select("id, title, cover_path, glossary_path, status").eq("book_id", book.id).eq("lang", lang).maybeSingle();
  if (!ed || ed.status !== "publiee") return null;
  const { data: acc } = await sb.from("edition_access").select("edition_id").eq("user_id", userId).eq("edition_id", ed.id).maybeSingle();
  if (!acc) return null;
  return { book, ed };
}

export const ouvrirCompagnon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug }).parse(d))
  .handler(async ({ context, data }) => {
    const lang = await langDuDomaine();
    const sb = context.supabase as Sb;
    const a = await editionAccessible(sb, context.userId, data.slug, lang);
    if (!a || !(await (await pw()).touchCompanion(context.userId, a.ed.id, lang))) return { allowed: false as const };
    const { book, ed } = a;

    const [{ data: col }, { data: pages }, { data: chaps }, { data: titres }, { data: quiz }] = await Promise.all([
      sb.from("collections").select("color_hex").eq("id", book.collection_id ?? "").maybeSingle(),
      sb.from("book_pages").select("id, page_no, chapter_no, audio_path").eq("book_id", book.id).eq("is_published", true).order("page_no"),
      sb.from("book_chapters").select("chapter_no, title_he").eq("book_id", book.id),
      sb.from("edition_chapter_titles").select("chapter_no, title").eq("edition_id", ed.id),
      sb.from("quiz_questions").select("id, sort_order, chapter_no, page_no, kind, question, hebrew, options, answer_index, explanation").eq("edition_id", ed.id).order("chapter_no").order("sort_order"),
    ]);

    const pageIds = (pages ?? []).map((p) => p.id);
    const paras: { id: string; page_id: string; sort_order: number; kind: string; he_nikud: string | null; he_plain: string | null }[] = [];
    for (let i = 0; i < pageIds.length; i += 100) {
      const { data: part } = await sb.from("page_paragraphs").select("id, page_id, sort_order, kind, he_nikud, he_plain").in("page_id", pageIds.slice(i, i + 100)).order("sort_order");
      paras.push(...(part ?? []));
    }
    const parPage = new Map<string, CompagnonParagraph[]>();
    for (const p of paras) {
      const l = parPage.get(p.page_id) ?? [];
      l.push({ id: p.id, kind: p.kind === "dialogue" ? "dialogue" : "narration", he_nikud: p.he_nikud, he_plain: p.he_plain });
      parPage.set(p.page_id, l);
    }
    const outPages: CompagnonPage[] = (pages ?? []).map((p) => ({ id: p.id, page_no: p.page_no, chapter_no: p.chapter_no, has_audio: Boolean(p.audio_path), paragraphs: parPage.get(p.id) ?? [] }));

    const chapNos = [...new Set([...outPages.map((p) => p.chapter_no), ...(quiz ?? []).map((q) => q.chapter_no)])].sort((x, y) => x - y);
    const chapters: CompagnonChapter[] = chapNos.map((n) => {
      const ps = outPages.filter((p) => p.chapter_no === n).map((p) => p.page_no);
      return {
        chapter_no: n,
        title_he: (chaps ?? []).find((c) => c.chapter_no === n)?.title_he ?? null,
        title: (titres ?? []).find((c) => c.chapter_no === n)?.title ?? null,
        pages: ps,
        first_page: ps.length ? ps[0]! : null,
        last_page: ps.length ? ps[ps.length - 1]! : null,
      };
    });

    const questions: QuizQuestion[] = (quiz ?? []).map((q) => ({
      id: q.id, sort_order: q.sort_order, chapter_no: q.chapter_no, page_no: q.page_no,
      kind: q.kind === "trou" ? "trou" : "qcm", question: q.question, hebrew: q.hebrew,
      options: Array.isArray(q.options) ? (q.options as unknown[]).map(String) : [],
      answer_index: q.answer_index, explanation: q.explanation,
    }));
    const lastAnswers: Record<string, LastAnswer> = {};
    const qids = questions.map((q) => q.id);
    for (let i = 0; i < qids.length; i += 200) {
      const { data: rows } = await sb.from("quiz_answers").select("question_id, chosen_index, is_correct, answered_at").eq("user_id", context.userId).in("question_id", qids.slice(i, i + 200)).order("answered_at");
      for (const r of rows ?? []) lastAnswers[r.question_id] = { chosen_index: r.chosen_index, is_correct: r.is_correct };
    }

    const { getSiteUrl } = await import("@/lib/compagnon.server");
    return {
      allowed: true as const,
      editionId: ed.id,
      title: ed.title,
      titleHe: book.title_he,
      coverUrl: ed.cover_path ? getSiteUrl(ed.cover_path) : null,
      color: col?.color_hex ?? null,
      hasGlossary: Boolean(ed.glossary_path),
      pages: outPages,
      chapters,
      questions,
      lastAnswers,
    };
  });

async function editionId(sb: Sb, userId: string, bookSlug: string, lang: Lang): Promise<string> {
  const a = await editionAccessible(sb, userId, bookSlug, lang);
  if (!a) throw new Error("FORBIDDEN");
  return a.ed.id;
}

export const urlAudioPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug, pageId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const lang = await langDuDomaine();
    const id = await editionId(context.supabase as Sb, context.userId, data.slug, lang);
    return { url: await (await pw()).signCompanionAudio(context.userId, id, lang, data.pageId) };
  });

export const urlGlossaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug }).parse(d))
  .handler(async ({ context, data }) => {
    const lang = await langDuDomaine();
    const id = await editionId(context.supabase as Sb, context.userId, data.slug, lang);
    return { url: await (await pw()).signCompanionGlossary(context.userId, id, lang) };
  });

export const repondreQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug, questionId: z.string().uuid(), chosen: z.number().int().min(0).max(20) }).parse(d))
  .handler(async ({ context, data }) => {
    const lang = await langDuDomaine();
    const id = await editionId(context.supabase as Sb, context.userId, data.slug, lang);
    return (await pw()).recordQuizAnswer(context.userId, id, lang, data.questionId, data.chosen);
  });
