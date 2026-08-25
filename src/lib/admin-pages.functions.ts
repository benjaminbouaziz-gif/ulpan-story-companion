import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./admin-spread.server";
import { hashText, translateFields } from "./translate.server";
import { autoEnglishPatch, sectionFieldStatus, translateDataObject } from "./translate-pages.server";

/** Les sections d'une page : lecture, écriture, versions, traduction. */
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
    if (!page) return { page: null, sections: [], statuses: {} };
    const { data: sections } = await context.supabase
      .from("page_sections")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order", { ascending: true });
    const rows = sections ?? [];
    const statuses: Record<string, Record<string, string>> = {};
    for (const s of rows) statuses[s.id] = await sectionFieldStatus(s);
    return { page, sections: rows, statuses };
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
    const { data: current } = await context.supabase
      .from("page_sections")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) return { ok: false, error: "Section introuvable." };

    const patch: Record<string, unknown> = {
      sort_order: data.sort_order,
      is_visible: data.is_visible,
      title_fr: data.title_fr,
      title_en: data.title_en,
      body_fr: data.body_fr,
      body_en: data.body_en,
      data: parsed as never,
    };

    // Un anglais modifié à la main passe en « human ».
    for (const field of ["title", "body"] as const) {
      const before = (current[`${field}_en`] as string | null) ?? "";
      const after = (data[`${field}_en`] as string | null) ?? "";
      if (after.trim() && after !== before) {
        patch[`${field}_en_source`] = "human";
        patch[`${field}_en_hash`] = await hashText((data[`${field}_fr`] as string | null) ?? "");
      }
    }

    // Un français modifié : l'anglais auto ou vide est retraduit.
    const auto = await autoEnglishPatch(context.supabase, context.userId, current, {
      title_fr: data.title_fr,
      title_en: (patch["title_en_source"] as string) === "human" ? null : data.title_en,
      body_fr: data.body_fr,
      body_en: (patch["body_en_source"] as string) === "human" ? null : data.body_en,
      data: parsed,
    });
    Object.assign(patch, auto.patch);

    const { error } = await context.supabase
      .from("page_sections")
      .update(patch as never)
      .eq("id", data.id);
    return { ok: !error, error: error?.message ?? auto.error ?? null };
  });

/** Retraduit tous les champs d'une page, y compris les anglais obsolètes. */
export const adminTranslatePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ slug: z.string().min(1), force: z.boolean().default(false) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId);
    const { data: page } = await context.supabase
      .from("pages")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!page) return { ok: false, translated: 0, error: "Page introuvable." };
    const { data: sections } = await context.supabase
      .from("page_sections")
      .select("*")
      .eq("page_id", page.id);
    let translated = 0;
    let error: string | null = null;
    for (const s of sections ?? []) {
      const row = s as unknown as Record<string, unknown>;
      const jobs: { field: string; fr: string }[] = [];
      for (const field of ["title", "body"] as const) {
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
      if (jobs.length > 0) {
        const run = await translateFields(
          context.supabase,
          jobs,
          { kind: "translate_page", entity: "page_section", entity_id: s.id, created_by: context.userId },
        );
        if (run.error) error = run.error;
        for (const r of run.results) {
          patch[`${r.field}_en`] = r.en;
          patch[`${r.field}_en_source`] = "auto";
          patch[`${r.field}_en_hash`] = await hashText(
            (row[`${r.field}_fr`] as string | null) ?? "",
          );
          translated += 1;
        }
      }
      const dataRes = await translateDataObject(
        context.supabase,
        context.userId,
        s.id,
        s.data as unknown,
        data.force,
      );
      if (dataRes.changed) {
        patch["data"] = dataRes.data as never;
        patch["data_en_source"] = "auto";
        patch["data_en_hash"] = await hashText(JSON.stringify(s.data ?? {}));
        translated += dataRes.count;
      }
      if (dataRes.error) error = dataRes.error;
      if (Object.keys(patch).length > 0)
        await context.supabase.from("page_sections").update(patch as never).eq("id", s.id);
    }
    return { ok: !error, translated, error };
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
