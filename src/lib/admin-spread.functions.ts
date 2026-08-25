import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./admin-spread.server";
import { toSpreadParagraph } from "./catalog.server";

const paragraphInput = z.object({
  sort_order: z.number().int(),
  stage_no: z.number().int().min(1).max(4),
  he: z.string().min(1),
  he_has_nikud: z.boolean(),
  support_kind: z.enum(["translation", "cloze", "vocabulary", "nikud"]),
  support_fr: z.string().nullable(),
  support_en: z.string().nullable(),
  support_he: z.string().nullable(),
});

export const adminMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return {
      userId: context.userId,
      roles,
      isEditor: roles.some((r) => r === "admin" || r === "editor"),
    };
  });

export const adminListSpread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookSlug: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: book } = await context.supabase
      .from("books")
      .select(
        "id, slug, title_fr, title_en, spread_running_head_fr, spread_running_head_en, spread_chapter_fr, spread_chapter_en, spread_folio_left",
      )
      .eq("slug", data.bookSlug)
      .maybeSingle();
    if (!book) return { book: null, paragraphs: [] };
    const { data: rows } = await context.supabase
      .from("spread_paragraphs")
      .select("*")
      .eq("book_id", book.id)
      .order("sort_order", { ascending: true });
    return { book, paragraphs: (rows ?? []).map(toSpreadParagraph) };
  });

export const adminSaveSpreadParagraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => paragraphInput.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("spread_paragraphs")
      .update(patch)
      .eq("id", id);
    return { ok: !error, error: error?.message ?? null };
  });

export const adminCreateSpreadParagraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => paragraphInput.extend({ book_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { error } = await context.supabase.from("spread_paragraphs").insert(data);
    return { ok: !error, error: error?.message ?? null };
  });

export const adminDeleteSpreadParagraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("spread_paragraphs")
      .delete()
      .eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });
