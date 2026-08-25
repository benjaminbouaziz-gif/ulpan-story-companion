import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Book, Collection } from "./catalog.functions";
import type { GlossaryItem, SpreadParagraph } from "./spread";

/**
 * L'espace lecteur. Rien n'est public : chaque lecture passe par la session,
 * et le livre n'est ouvert que si le lecteur a franchi le QR code.
 */

export type QuizQuestion = {
  id: string;
  sort_order: number;
  chapter_no: number | null;
  kind: string;
  prompt_fr: string | null;
  prompt_en: string | null;
  prompt_he: string | null;
  options: string[];
  answer_index: number;
  explain_fr: string | null;
  explain_en: string | null;
};

export type AudioTrack = {
  id: string;
  chapter_no: number | null;
  label_fr: string | null;
  label_en: string | null;
  duration_s: number | null;
};

export type ReaderProgress = { quiz_answered: number; quiz_correct: number } | null;

/** Les livres ouverts par ce lecteur, du plus récemment consulté au plus ancien. */
export const listMyBooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: access } = await context.supabase
      .from("book_access")
      .select("book_id, last_seen_at")
      .eq("user_id", context.userId)
      .order("last_seen_at", { ascending: false });
    const ids = (access ?? []).map((a) => a.book_id);
    if (ids.length === 0) return { books: [] as Book[] };
    const { data: books } = await context.supabase.from("books").select("*").in("id", ids);
    const byId = new Map((books ?? []).map((b) => [b.id, b as Book]));
    return { books: ids.map((id) => byId.get(id)).filter((b): b is Book => !!b) };
  });

/** Le compagnon d'un livre : glossaire complet, entraînement, lectures audio. */
export const getCompanionBook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ context, data }) => {
    const empty = {
      allowed: false,
      book: null as Book | null,
      collection: null as Collection | null,
      glossary: [] as GlossaryItem[],
      quiz: [] as QuizQuestion[],
      audio: [] as AudioTrack[],
      paragraphs: [] as SpreadParagraph[],
      progress: null as ReaderProgress,
    };

    const { data: book } = await context.supabase
      .from("books")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!book) return empty;

    const { data: access } = await context.supabase
      .from("book_access")
      .select("id")
      .eq("user_id", context.userId)
      .eq("book_id", book.id)
      .maybeSingle();
    if (!access) return { ...empty, book: book as Book };

    const [{ data: gloss }, { data: quiz }, { data: audio }, { data: progress }] =
      await Promise.all([
        context.supabase
          .from("glossary_entries")
          .select("id, sort_order, lemma_he, sense_fr, sense_en")
          .eq("book_id", book.id)
          .order("sort_order", { ascending: true }),
        context.supabase
          .from("quiz_questions")
          .select("*")
          .eq("book_id", book.id)
          .order("sort_order", { ascending: true }),
        context.supabase
          .from("audio_tracks")
          .select("id, chapter_no, label_fr, label_en, duration_s")
          .eq("book_id", book.id)
          .order("chapter_no", { ascending: true }),
        context.supabase
          .from("reader_progress")
          .select("quiz_answered, quiz_correct")
          .eq("user_id", context.userId)
          .eq("book_id", book.id)
          .maybeSingle(),
      ]);

    let collection: Collection | null = null;
    if (book.collection_id) {
      const { data: c } = await context.supabase
        .from("collections")
        .select("*")
        .eq("id", book.collection_id)
        .maybeSingle();
      collection = (c as Collection) ?? null;
    }

    // La visite est datée : c'est ce qui ordonne la liste des livres ouverts.
    await context.supabase
      .from("book_access")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("book_id", book.id);

    return {
      allowed: true,
      book: book as Book,
      collection,
      glossary: (gloss ?? []) as GlossaryItem[],
      quiz: (quiz ?? []).map((q) => ({
        id: q.id,
        sort_order: q.sort_order,
        chapter_no: q.chapter_no,
        kind: q.kind as string,
        prompt_fr: q.prompt_fr,
        prompt_en: q.prompt_en,
        prompt_he: q.prompt_he,
        options: Array.isArray(q.options) ? (q.options as unknown[]).map(String) : [],
        answer_index:
          typeof (q.answer as { index?: number } | null)?.index === "number"
            ? (q.answer as { index: number }).index
            : 0,
        explain_fr: q.explain_fr,
        explain_en: q.explain_en,
      })) as QuizQuestion[],
      audio: (audio ?? []) as AudioTrack[],
      paragraphs: [] as SpreadParagraph[],
      progress: (progress ?? null) as ReaderProgress,
    };
  });

/** La progression, comptée en réponses données et en réponses justes. */
export const saveQuizRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        book_slug: z.string().min(1).max(120),
        answered: z.number().int().min(0).max(500),
        correct: z.number().int().min(0).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: book } = await context.supabase
      .from("books")
      .select("id")
      .eq("slug", data.book_slug)
      .maybeSingle();
    if (!book) return { ok: false };
    const { data: access } = await context.supabase
      .from("book_access")
      .select("id")
      .eq("user_id", context.userId)
      .eq("book_id", book.id)
      .maybeSingle();
    if (!access) return { ok: false };

    const { data: current } = await context.supabase
      .from("reader_progress")
      .select("quiz_answered, quiz_correct")
      .eq("user_id", context.userId)
      .eq("book_id", book.id)
      .maybeSingle();

    const answered = (current?.quiz_answered ?? 0) + data.answered;
    const correct = (current?.quiz_correct ?? 0) + data.correct;
    await context.supabase.from("reader_progress").upsert(
      {
        user_id: context.userId,
        book_id: book.id,
        quiz_answered: answered,
        quiz_correct: correct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,book_id" },
    );
    return { ok: true, answered, correct };
  });
