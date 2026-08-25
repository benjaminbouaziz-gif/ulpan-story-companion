import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./admin-segments.server";
import { toMirrorSegment } from "./catalog.server";

const tokenSchema = z.object({
  he_nikud: z.string().min(1),
  he_plain: z.string().nullable().optional(),
  translit: z.string().nullable().optional(),
  gloss_fr: z.string().nullable().optional(),
  gloss_en: z.string().nullable().optional(),
  note_fr: z.string().nullable().optional(),
  note_en: z.string().nullable().optional(),
  support_range_fr: z.tuple([z.number(), z.number()]).nullable().optional(),
  support_range_en: z.tuple([z.number(), z.number()]).nullable().optional(),
  is_hard: z.boolean().optional(),
});

export const adminMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return { userId: context.userId, roles, isEditor: roles.some((r) => r === "admin" || r === "editor") };
  });

export const adminListSegments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookSlug: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: book } = await context.supabase
      .from("books")
      .select("id, slug, title_fr")
      .eq("slug", data.bookSlug)
      .maybeSingle();
    if (!book) return { book: null, segments: [] };
    const { data: rows } = await context.supabase
      .from("excerpt_segments")
      .select("*")
      .eq("book_id", book.id)
      .order("chapter_no", { ascending: true })
      .order("sort_order", { ascending: true });
    return { book, segments: (rows ?? []).map(toMirrorSegment) };
  });

export const adminSaveSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        support_fr: z.string().nullable(),
        support_en: z.string().nullable(),
        hard_words_fr: z.string().nullable(),
        hard_words_en: z.string().nullable(),
        tokens: z.array(tokenSchema),
        is_showcase: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { id, is_showcase, ...patch } = data;
    const { error } = await context.supabase
      .from("excerpt_segments")
      .update({
        ...patch,
        tokens: patch.tokens,
        ...(is_showcase === undefined ? {} : { is_showcase }),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null as string | null };
  });
