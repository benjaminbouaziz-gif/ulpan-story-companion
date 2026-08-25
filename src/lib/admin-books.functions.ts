import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./admin-spread.server";
import { hashText, translateFields } from "./translate.server";

/**
 * Les chiffres du livre : saisis à la main, jamais verrouillés. Le comptage en
 * base n'est qu'une indication affichée à côté du champ.
 */
export const adminBookFigures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: books } = await context.supabase
      .from("books")
      .select(
        "id, slug, tome_no, title_fr, spread_pages, kdp_page_count, chapters_count, words_unique, figures_verified_at",
      )
      .order("tome_no", { ascending: true });
    const rows = books ?? [];
    const counted: Record<
      string,
      { chapters_count: number | null; words_unique: number | null; spread_pages: number | null }
    > = {};
    for (const b of rows) {
      const [{ data: gloss }, { data: quiz }, { data: paras }] = await Promise.all([
        context.supabase.from("glossary_entries").select("chapter_no, lemma_he").eq("book_id", b.id),
        context.supabase.from("quiz_questions").select("chapter_no").eq("book_id", b.id),
        context.supabase.from("spread_paragraphs").select("id").eq("book_id", b.id),
      ]);
      const chapters = new Set<number>();
      for (const g of gloss ?? []) if (g.chapter_no) chapters.add(g.chapter_no);
      for (const q of quiz ?? []) if (q.chapter_no) chapters.add(q.chapter_no);
      const lemmas = new Set((gloss ?? []).map((g) => g.lemma_he));
      counted[b.id] = {
        chapters_count: chapters.size > 0 ? chapters.size : null,
        words_unique: lemmas.size > 0 ? lemmas.size : null,
        spread_pages: b.kdp_page_count ? Math.ceil(b.kdp_page_count / 2) : (paras ?? []).length || null,
      };
    }
    return { books: rows, counted };
  });

/** Enregistre les chiffres tels qu'ils sont saisis. Rien n'est refusé. */
export const adminSaveBookFigures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        spread_pages: z.number().int().nullable(),
        kdp_page_count: z.number().int().nullable(),
        chapters_count: z.number().int().nullable(),
        words_unique: z.number().int().nullable(),
        confirm: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { id, confirm, ...figures } = data;
    const { error } = await context.supabase
      .from("books")
      .update({
        ...figures,
        ...(confirm ? { figures_verified_at: new Date().toISOString() } : {}),
      })
      .eq("id", id);
    return { ok: !error, error: error?.message ?? null };
  });

/** Traduit les champs éditoriaux du livre. Les soutiens ne passent jamais ici. */
export const adminTranslateBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), force: z.boolean().default(false) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: book } = await context.supabase
      .from("books")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!book) return { ok: false, translated: 0, error: "Livre introuvable." };
    const row = book as unknown as Record<string, unknown>;
    const jobs: { field: string; fr: string }[] = [];
    for (const field of ["blurb", "level_note"] as const) {
      const fr = (row[`${field}_fr`] as string | null) ?? "";
      const en = (row[`${field}_en`] as string | null) ?? "";
      const source = (row[`${field}_en_source`] as string | null) ?? null;
      if (!fr.trim()) continue;
      if (source === "human" && !data.force) continue;
      if (en.trim() && source === "auto" && row[`${field}_en_hash`] === (await hashText(fr)))
        continue;
      jobs.push({ field, fr });
    }
    const patch: Record<string, unknown> = {};
    let error: string | null = null;
    if (jobs.length > 0) {
      const run = await translateFields(context.supabase, jobs, {
        kind: "translate_book",
        entity: "book",
        entity_id: book.id,
        created_by: context.userId,
      });
      error = run.error;
      for (const r of run.results) {
        patch[`${r.field}_en`] = r.en;
        patch[`${r.field}_en_source`] = "auto";
        patch[`${r.field}_en_hash`] = await hashText((row[`${r.field}_fr`] as string) ?? "");
      }
    }
    // « Ce qu'on y apprend » : une liste de phrases françaises.
    const learn = Array.isArray(book.what_you_learn_fr)
      ? (book.what_you_learn_fr as unknown[]).map((v) => String(v))
      : [];
    const hasEn =
      Array.isArray(book.what_you_learn_en) && (book.what_you_learn_en as unknown[]).length > 0;
    if (learn.length > 0 && (!hasEn || data.force)) {
      const run = await translateFields(
        context.supabase,
        learn.map((fr, i) => ({ field: String(i), fr })),
        { kind: "translate_book", entity: "book", entity_id: book.id, created_by: context.userId },
      );
      if (run.error) error = run.error;
      if (run.results.length === learn.length) {
        const out = learn.map((_, i) => run.results.find((r) => r.field === String(i))?.en ?? "");
        patch["what_you_learn_en"] = out as never;
        patch["what_you_learn_en_source"] = "auto";
        patch["what_you_learn_en_hash"] = await hashText(JSON.stringify(learn));
      }
    }
    if (Object.keys(patch).length > 0)
      await context.supabase.from("books").update(patch as never).eq("id", book.id);
    return { ok: !error, translated: Object.keys(patch).length, error };
  });
