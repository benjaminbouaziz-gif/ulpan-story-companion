import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COLLECTION_KINDS, KINDS_BY_PAGE, PAGE_KEYS, type Block, type BlockKind, type PageKey } from "@/lib/site-blocks";
import { slugProbleme } from "@/lib/slug";

/**
 * ADMIN — blocs du site et des collections, collections, étapes de la méthode.
 * Chaîne : requireSupabaseAuth → assertEditor → getAdminClient.
 */
const SITE = "site";
const MAX_IMAGE = 10 * 1024 * 1024;
const IMAGE_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

type Ctx = { supabase: Parameters<typeof import("@/lib/editor-context.server").assertEditor>[0]; userId: string };
async function editorAdmin(context: Ctx) {
  const { assertEditor } = await import("@/lib/editor-context.server");
  const { getAdminClient } = await import("@/lib/supabase-admin.server");
  return getAdminClient(await assertEditor(context.supabase, context.userId));
}
type Admin = Awaited<ReturnType<typeof editorAdmin>>;

const uuid = z.string().uuid();
const lang = z.enum(["fr", "en"]);
const nul = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};
const publicUrl = (admin: Admin, p: string | null, v?: string) =>
  p ? `${admin.storage.from(SITE).getPublicUrl(p).data.publicUrl}${v ? `?v=${encodeURIComponent(v)}` : ""}` : null;

function imageExt(file: File) {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const type = IMAGE_EXT[ext];
  if (!type) throw new Error("IMAGE_BAD_FORMAT");
  if (file.size > MAX_IMAGE) throw new Error("IMAGE_TOO_BIG");
  return { ext: ext === "jpeg" ? "jpg" : ext, type };
}

/* ------------------------------------------------------------------ */
/* Blocs : cible = page du site ou collection                          */
/* ------------------------------------------------------------------ */

const target = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("site"), pageKey: z.enum(PAGE_KEYS), lang }),
  z.object({ scope: z.literal("collection"), collectionId: uuid, lang }),
]);
type Target = z.infer<typeof target>;
const scopeSchema = z.enum(["site", "collection"]);
type Scope = z.infer<typeof scopeSchema>;

const table = (s: Scope) => (s === "site" ? "site_blocks" : "collection_blocks");
const entity = (s: Scope) => (s === "site" ? "site_block" : "collection_block");
const kindsFor = (t: Target): readonly BlockKind[] => (t.scope === "site" ? KINDS_BY_PAGE[t.pageKey as PageKey] : COLLECTION_KINDS);

function norm(row: Record<string, unknown>): Block {
  return {
    id: row["id"] as string,
    kind: row["kind"] as BlockKind,
    sort_order: row["sort_order"] as number,
    title: (row["title"] as string | null) ?? null,
    body: (row["body"] as string | null) ?? null,
    items: (Array.isArray(row["items"]) ? row["items"] : []) as Block["items"],
    image_path: (row["image_path"] as string | null) ?? null,
    is_visible: row["is_visible"] as boolean,
  };
}

async function lireBlocs(admin: Admin, t: Target) {
  const q = t.scope === "site"
    ? admin.from("site_blocks").select("*").eq("page_key", t.pageKey).eq("lang", t.lang)
    : admin.from("collection_blocks").select("*").eq("collection_id", t.collectionId).eq("lang", t.lang);
  const { data, error } = await q.order("sort_order");
  if (error) throw new Error("LOAD_FAILED");
  return (data ?? []).map((r) => norm(r as Record<string, unknown>));
}

async function unBloc(admin: Admin, scope: Scope, id: string) {
  const { data } = await admin.from(table(scope)).select("*").eq("id", id).maybeSingle();
  if (!data) throw new Error("BLOCK_NOT_FOUND");
  return data as Record<string, unknown>;
}

async function instantane(admin: Admin, scope: Scope, row: Record<string, unknown>, userId: string) {
  await admin.from("content_versions").insert({ entity: entity(scope), entity_id: row["id"] as string, snapshot: row as never, created_by: userId });
}

export const listBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => target.parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const blocs = await lireBlocs(admin, data);
    return blocs.map((b) => ({ ...b, imageUrl: publicUrl(admin, b.image_path, String(b.sort_order) + b.id) }));
  });

export const addBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ target, kind: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    if (!kindsFor(data.target).includes(data.kind as BlockKind)) throw new Error("KIND_NOT_ALLOWED");
    const blocs = await lireBlocs(admin, data.target);
    const sort = (blocs.at(-1)?.sort_order ?? 0) + 1;
    const t = data.target;
    const { data: row, error } = t.scope === "site"
      ? await admin.from("site_blocks").insert({ page_key: t.pageKey, lang: t.lang, kind: data.kind, sort_order: sort, items: [] }).select("*").single()
      : await admin.from("collection_blocks").insert({ collection_id: t.collectionId, lang: t.lang, kind: data.kind, sort_order: sort }).select("*").single();
    if (error || !row) throw new Error("SAVE_FAILED");
    await instantane(admin, t.scope, row as Record<string, unknown>, context.userId);
    return { id: (row as { id: string }).id };
  });

const itemSchema = z.array(z.record(z.string(), z.string().max(5000))).max(100);
const blockInput = z.object({
  id: uuid,
  sort_order: z.number().int().min(0).max(100000),
  title: z.string().max(1000).nullable(),
  body: z.string().max(50000).nullable(),
  items: itemSchema,
  is_visible: z.boolean(),
});

const ITEM_KEYS: Partial<Record<BlockKind, string[]>> = {
  etapes: ["numero", "titre", "texte"],
  faq: ["question", "reponse"],
  chiffres: ["valeur", "libelle"],
};

/** Enregistre les blocs modifiés d'un onglet ; chaque bloc enregistré ajoute un instantané. */
export const saveBlocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ target, blocks: z.array(blockInput).max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const existants = new Map((await lireBlocs(admin, data.target)).map((b) => [b.id, b]));
    const scope = data.target.scope;
    for (const b of data.blocks) {
      const cur = existants.get(b.id);
      if (!cur) throw new Error("BLOCK_NOT_FOUND");
      const keys = ITEM_KEYS[cur.kind];
      const items = keys ? b.items.map((it) => Object.fromEntries(keys.map((k) => [k, (it[k] ?? "").trim()]))) : [];
      const patch: Record<string, unknown> = { sort_order: b.sort_order, title: nul(b.title), body: nul(b.body), is_visible: b.is_visible };
      if (scope === "site") patch["items"] = items;
      const { data: row, error } = await admin.from(table(scope)).update(patch as never).eq("id", b.id).select("*").single();
      if (error || !row) throw new Error("SAVE_FAILED");
      await instantane(admin, scope, row as Record<string, unknown>, context.userId);
    }
    return { ok: true };
  });

export const removeBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scope: scopeSchema, id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const row = await unBloc(admin, data.scope, data.id);
    await instantane(admin, data.scope, row, context.userId);
    const { error } = await admin.from(table(data.scope)).delete().eq("id", data.id);
    if (error) throw new Error("DELETE_FAILED");
    if (row["image_path"]) await admin.storage.from(SITE).remove([row["image_path"] as string]);
    return { ok: true };
  });

export const uploadBlockImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error("BAD_REQUEST");
    const scope = scopeSchema.parse(d.get("scope"));
    const id = uuid.parse(d.get("id"));
    const file = d.get("file");
    if (!(file instanceof File)) throw new Error("BAD_REQUEST");
    return { scope, id, file };
  })
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const row = await unBloc(admin, data.scope, data.id);
    if (row["kind"] !== "image") throw new Error("KIND_NOT_ALLOWED");
    const { ext, type } = imageExt(data.file);
    const path = `blocks/${data.id}.${ext}`;
    const { error } = await admin.storage.from(SITE).upload(path, new Uint8Array(await data.file.arrayBuffer()), { upsert: true, contentType: type });
    if (error) throw new Error("UPLOAD_FAILED");
    const old = row["image_path"] as string | null;
    if (old && old !== path) await admin.storage.from(SITE).remove([old]);
    const { data: nrow, error: e2 } = await admin.from(table(data.scope)).update({ image_path: path } as never).eq("id", data.id).select("*").single();
    if (e2 || !nrow) throw new Error("SAVE_FAILED");
    await instantane(admin, data.scope, nrow as Record<string, unknown>, context.userId);
    return { ok: true };
  });

export const blockHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scope: scopeSchema, id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: rows } = await admin
      .from("content_versions")
      .select("id, snapshot, created_by, created_at")
      .eq("entity", entity(data.scope))
      .eq("entity_id", data.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const auteurs = new Map<string, string>();
    for (const uid of new Set((rows ?? []).map((r) => r.created_by).filter((x): x is string => !!x))) {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      auteurs.set(uid, u.user?.email ?? "—");
    }
    return (rows ?? []).map((r) => {
      const s = r.snapshot as Record<string, unknown>;
      const extrait = [s["title"], s["body"]].filter((x) => typeof x === "string" && x).join(" — ").slice(0, 120);
      return { id: r.id, createdAt: r.created_at, auteur: r.created_by ? auteurs.get(r.created_by) ?? "—" : "—", extrait };
    });
  });

export const restoreVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scope: scopeSchema, versionId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: v } = await admin.from("content_versions").select("entity, entity_id, snapshot").eq("id", data.versionId).maybeSingle();
    if (!v || v.entity !== entity(data.scope)) throw new Error("VERSION_NOT_FOUND");
    await unBloc(admin, data.scope, v.entity_id);
    const s = v.snapshot as Record<string, unknown>;
    const patch: Record<string, unknown> = { title: s["title"] ?? null, body: s["body"] ?? null, is_visible: s["is_visible"] ?? true, image_path: s["image_path"] ?? null };
    if (data.scope === "site") patch["items"] = s["items"] ?? [];
    const { data: row, error } = await admin.from(table(data.scope)).update(patch as never).eq("id", v.entity_id).select("*").single();
    if (error || !row) throw new Error("SAVE_FAILED");
    await instantane(admin, data.scope, row as Record<string, unknown>, context.userId);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Collections                                                         */
/* ------------------------------------------------------------------ */

async function slugLibre(admin: Admin, slug: string, exceptCollectionId?: string) {
  const p = slugProbleme(slug);
  if (p) throw new Error(p);
  const { data: b } = await admin.from("books").select("id").eq("slug", slug).maybeSingle();
  if (b) throw new Error("SLUG_TAKEN");
  const { data: c } = await admin.from("collections").select("id").eq("slug", slug).maybeSingle();
  if (c && c.id !== exceptCollectionId) throw new Error("SLUG_TAKEN");
}

export const adminCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await editorAdmin(context);
    const [{ data: cols }, { data: texts }, { data: books }, { data: eds }] = await Promise.all([
      admin.from("collections").select("id, slug, color_hex, sort_order, is_visible").order("sort_order"),
      admin.from("collection_texts").select("collection_id, lang, name"),
      admin.from("books").select("id, collection_id"),
      admin.from("book_editions").select("book_id, lang, status"),
    ]);
    return (cols ?? []).map((c) => {
      const bookIds = new Set((books ?? []).filter((b) => b.collection_id === c.id).map((b) => b.id));
      const pub = (l: string) => (eds ?? []).filter((e) => bookIds.has(e.book_id) && e.lang === l && e.status === "publiee").length;
      const nom = (l: string) => nul(texts?.find((t) => t.collection_id === c.id && t.lang === l)?.name) ?? null;
      return { id: c.id, slug: c.slug, color: c.color_hex, sortOrder: c.sort_order, isVisible: c.is_visible, nameFr: nom("fr"), nameEn: nom("en"), pubFr: pub("fr"), pubEn: pub("en") };
    });
  });

export const createCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string().trim().max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    await slugLibre(admin, data.slug);
    const { data: last } = await admin.from("collections").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { error } = await admin.from("collections").insert({ slug: data.slug, sort_order: (last?.sort_order ?? 0) + 1, is_visible: false });
    if (error) throw new Error(error.code === "23505" ? "SLUG_TAKEN" : "SAVE_FAILED");
    return { slug: data.slug };
  });

export const adminCollection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string().max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: c } = await admin.from("collections").select("*").eq("slug", data.slug).maybeSingle();
    if (!c) throw new Error("COLLECTION_NOT_FOUND");
    const [{ data: texts }, { data: books }] = await Promise.all([
      admin.from("collection_texts").select("*").eq("collection_id", c.id),
      admin.from("books").select("id, slug, tome_no").eq("collection_id", c.id).order("tome_no"),
    ]);
    const ids = (books ?? []).map((b) => b.id);
    const { data: eds } = ids.length ? await admin.from("book_editions").select("id, book_id, lang, status").in("book_id", ids) : { data: [] };
    const text = (l: "fr" | "en") => {
      const t = texts?.find((x) => x.lang === l);
      return { name: t?.name ?? "", tagline: t?.tagline ?? "", description: t?.description ?? "", forWhom: t?.for_whom ?? "" };
    };
    const slugLocked = (eds ?? []).some((e) => e.status === "publiee");
    return {
      collection: { id: c.id, slug: c.slug, color: c.color_hex, sortOrder: c.sort_order, isVisible: c.is_visible, slugLocked },
      texts: { fr: text("fr"), en: text("en") },
      tomes: (books ?? []).map((b) => ({
        slug: b.slug,
        tomeNo: b.tome_no,
        editions: (eds ?? []).filter((e) => e.book_id === b.id).map((e) => ({ lang: e.lang, status: e.status })),
      })),
    };
  });

export const saveCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid,
      slug: z.string().trim().max(80),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      sortOrder: z.number().int().min(0).max(100000),
      isVisible: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: c } = await admin.from("collections").select("slug").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("COLLECTION_NOT_FOUND");
    if (data.slug !== c.slug) {
      const { data: books } = await admin.from("books").select("id").eq("collection_id", data.id);
      const ids = (books ?? []).map((b) => b.id);
      if (ids.length) {
        const { count } = await admin.from("book_editions").select("id", { count: "exact", head: true }).in("book_id", ids).eq("status", "publiee");
        if (count) throw new Error("SLUG_LOCKED");
      }
      await slugLibre(admin, data.slug, data.id);
    }
    const { error } = await admin
      .from("collections")
      .update({ slug: data.slug, color_hex: data.color.toLowerCase(), sort_order: data.sortOrder, is_visible: data.isVisible })
      .eq("id", data.id);
    if (error) throw new Error(error.code === "23505" ? "SLUG_TAKEN" : "SAVE_FAILED");
    return { slug: data.slug };
  });

export const saveCollectionTexts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid,
      lang,
      name: z.string().max(300),
      tagline: z.string().max(500),
      description: z.string().max(10000),
      forWhom: z.string().max(5000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { error } = await admin.from("collection_texts").upsert(
      { collection_id: data.id, lang: data.lang, name: nul(data.name), tagline: nul(data.tagline), description: nul(data.description), for_whom: nul(data.forWhom) },
      { onConflict: "collection_id,lang" },
    );
    if (error) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, confirmSlug: z.string().max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: c } = await admin.from("collections").select("slug").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("COLLECTION_NOT_FOUND");
    if (c.slug !== data.confirmSlug) throw new Error("CONFIRM_MISMATCH");
    const { count } = await admin.from("books").select("id", { count: "exact", head: true }).eq("collection_id", data.id);
    if (count) throw new Error("COLLECTION_HAS_BOOKS");
    const { data: imgs } = await admin.from("collection_blocks").select("image_path").eq("collection_id", data.id);
    const { error } = await admin.from("collections").delete().eq("id", data.id);
    if (error) throw new Error("DELETE_FAILED");
    const paths = (imgs ?? []).map((i) => i.image_path).filter((p): p is string => !!p);
    if (paths.length) await admin.storage.from(SITE).remove(paths);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Méthode : les 4 étapes en images                                    */
/* ------------------------------------------------------------------ */

export const methodSteps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lang }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: rows } = await admin.from("method_steps").select("*").eq("lang", data.lang).order("step_no");
    return [1, 2, 3, 4].map((n) => {
      const r = rows?.find((x) => x.step_no === n);
      return { stepNo: n, tabLabel: r?.tab_label ?? "", imageUrl: publicUrl(admin, r?.image_path ?? null, r?.updated_at) };
    });
  });

export const saveMethodLabels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lang, labels: z.array(z.object({ stepNo: z.number().int().min(1).max(4), tabLabel: z.string().max(100) })).max(4) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { error } = await admin.from("method_steps").upsert(
      data.labels.map((l) => ({ lang: data.lang, step_no: l.stepNo, tab_label: l.tabLabel.trim() })),
      { onConflict: "lang,step_no" },
    );
    if (error) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

export const uploadMethodImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error("BAD_REQUEST");
    const file = d.get("file");
    if (!(file instanceof File)) throw new Error("BAD_REQUEST");
    return { lang: lang.parse(d.get("lang")), stepNo: z.coerce.number().int().min(1).max(4).parse(d.get("stepNo")), file };
  })
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { ext, type } = imageExt(data.file);
    const path = `method/${data.lang}-${data.stepNo}.${ext}`;
    const { data: cur } = await admin.from("method_steps").select("image_path, tab_label").eq("lang", data.lang).eq("step_no", data.stepNo).maybeSingle();
    const { error } = await admin.storage.from(SITE).upload(path, new Uint8Array(await data.file.arrayBuffer()), { upsert: true, contentType: type });
    if (error) throw new Error("UPLOAD_FAILED");
    if (cur?.image_path && cur.image_path !== path) await admin.storage.from(SITE).remove([cur.image_path]);
    const { error: e2 } = await admin.from("method_steps").upsert({ lang: data.lang, step_no: data.stepNo, tab_label: cur?.tab_label ?? "", image_path: path }, { onConflict: "lang,step_no" });
    if (e2) throw new Error("SAVE_FAILED");
    return { ok: true };
  });

export const removeMethodImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lang, stepNo: z.number().int().min(1).max(4) }).parse(d))
  .handler(async ({ context, data }) => {
    const admin = await editorAdmin(context);
    const { data: cur } = await admin.from("method_steps").select("image_path").eq("lang", data.lang).eq("step_no", data.stepNo).maybeSingle();
    const { error } = await admin.from("method_steps").update({ image_path: null }).eq("lang", data.lang).eq("step_no", data.stepNo);
    if (error) throw new Error("SAVE_FAILED");
    if (cur?.image_path) await admin.storage.from(SITE).remove([cur.image_path]);
    return { ok: true };
  });
