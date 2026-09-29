import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PAGE_KEYS } from "./site-blocks";
import { blocksPageData, bookData, collectionData, collectionsData, homeData } from "./vitrine.data";

/** Lectures publiques de la vitrine : clé publique, sous RLS, langue donnée. */
const lang = z.enum(["fr", "en"]);
const slug = z.string().min(1).max(120);

export const getHome = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ lang }).parse(d))
  .handler(({ data }) => homeData(supabase, data.lang, "public"));

export const getBlocksPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ lang, pageKey: z.enum(PAGE_KEYS), withSteps: z.boolean().optional() }).parse(d))
  .handler(({ data }) => blocksPageData(supabase, data.pageKey, data.lang, "public", data.withSteps));

export const getCollections = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ lang }).parse(d))
  .handler(({ data }) => collectionsData(supabase, data.lang, "public"));

export const getCollection = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ lang, slug }).parse(d))
  .handler(({ data }) => collectionData(supabase, data.lang, "public", { slug: data.slug }));

export const getBook = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ lang, slug }).parse(d))
  .handler(({ data }) => bookData(supabase, data.lang, "public", { slug: data.slug }));

/** Seule écriture de la vitrine : un clic Amazon, sans donnée personnelle. */
export const clickAmazon = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ editionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { recordAmazonClick } = await import("@/lib/public-writes.server");
    const fwd = (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim();
    const ip = fwd || getRequestHeader("cf-connecting-ip") || getRequestHeader("x-real-ip") || "inconnue";
    return { ok: await recordAmazonClick(data.editionId, ip) };
  });
