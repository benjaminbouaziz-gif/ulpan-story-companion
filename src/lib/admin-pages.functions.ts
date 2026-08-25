import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./admin-spread.server";

/** Les sections d'une page : lecture, écriture, versions. Rôle vérifié en base. */
export const adminListSections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: page } = await context.supabase
      .from("pages")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!page) return { page: null, sections: [] };
    const { data: sections } = await context.supabase
      .from("page_sections")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order", { ascending: true });
    return { page, sections: sections ?? [] };
  });

export const adminSaveSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        sort_order: z.number().int(),
        is_visible: z.boolean(),
        title_fr: z.string().nullable(),
        title_en: z.string().nullable(),
        body_fr: z.string().nullable(),
        body_en: z.string().nullable(),
        data_json: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.data_json || "{}");
    } catch {
      return { ok: false, error: "Le bloc de données n'est pas un JSON valide." };
    }
    const { id, data_json: _ignored, ...patch } = data;
    const { error } = await context.supabase
      .from("page_sections")
      .update({ ...patch, data: parsed as never })
      .eq("id", id);
    return { ok: !error, error: error?.message ?? null };
  });

export const adminDeleteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("page_sections")
      .delete()
      .eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });

export const adminSectionVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: rows } = await context.supabase
      .from("content_versions")
      .select("id, created_at, snapshot")
      .eq("entity", "page_section")
      .eq("entity_id", data.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return { versions: rows ?? [] };
  });

/** Restaure une version archivée : le contenu revient, l'archive s'allonge. */
export const adminRestoreSectionVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ version_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: version } = await context.supabase
      .from("content_versions")
      .select("entity, entity_id, snapshot")
      .eq("id", data.version_id)
      .maybeSingle();
    if (!version || version.entity !== "page_section")
      return { ok: false, error: "Version introuvable." };
    const snap = version.snapshot as Record<string, unknown>;
    const { error } = await context.supabase
      .from("page_sections")
      .update({
        sort_order: Number(snap["sort_order"] ?? 0),
        is_visible: Boolean(snap["is_visible"] ?? true),
        title_fr: (snap["title_fr"] as string | null) ?? null,
        title_en: (snap["title_en"] as string | null) ?? null,
        body_fr: (snap["body_fr"] as string | null) ?? null,
        body_en: (snap["body_en"] as string | null) ?? null,
        data: (snap["data"] ?? {}) as never,
      })
      .eq("id", version.entity_id);
    return { ok: !error, error: error?.message ?? null };
  });
