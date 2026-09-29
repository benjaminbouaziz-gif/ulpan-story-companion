import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PAGE_KEYS } from "./site-blocks";

/**
 * Aperçus de l'admin : mêmes lectures que la vitrine, en mode "apercu"
 * (non-publié visible), réservées aux éditeurs.
 * Chaîne : requireSupabaseAuth → assertEditor → getAdminClient.
 */
type Ctx = { supabase: Parameters<typeof import("@/lib/editor-context.server").assertEditor>[0]; userId: string };
async function editorDb(context: Ctx) {
  const { assertEditor } = await import("@/lib/editor-context.server");
  const { getAdminClient } = await import("@/lib/supabase-admin.server");
  return getAdminClient(await assertEditor(context.supabase, context.userId));
}
const lang = z.enum(["fr", "en"]);

export const apercuHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lang }).parse(d))
  .handler(async ({ context, data }) => {
    const { homeData } = await import("./vitrine.data");
    return homeData(await editorDb(context), data.lang, "apercu");
  });

export const apercuBlocksPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lang, pageKey: z.enum(PAGE_KEYS), withSteps: z.boolean().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { blocksPageData } = await import("./vitrine.data");
    return blocksPageData(await editorDb(context), data.pageKey, data.lang, "apercu", data.withSteps);
  });

export const apercuCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lang, collectionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { collectionData } = await import("./vitrine.data");
    return collectionData(await editorDb(context), data.lang, "apercu", { id: data.collectionId });
  });

export const apercuBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lang, editionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { bookData } = await import("./vitrine.data");
    return bookData(await editorDb(context), data.lang, "apercu", { editionId: data.editionId });
  });
