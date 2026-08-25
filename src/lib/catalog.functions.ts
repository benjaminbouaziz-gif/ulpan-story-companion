import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { publicClient, toMirrorSegment } from "./catalog.server";

export type Collection = Database["public"]["Tables"]["collections"]["Row"];
export type Book = Database["public"]["Tables"]["books"]["Row"];
export type Page = Database["public"]["Tables"]["pages"]["Row"];
export type PageSection = Database["public"]["Tables"]["page_sections"]["Row"];

export const getCollections = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return { collections: [] as Collection[], error: error.message };
  return { collections: data as Collection[], error: null as string | null };
});

export const getPublishedBooks = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("tome_no", { ascending: true });
  if (error) return { books: [] as Book[], error: error.message };
  return { books: data as Book[], error: null as string | null };
});

export const getCollectionBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: collection } = await supabase
      .from("collections")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!collection) return { collection: null, books: [] as Book[] };
    const { data: books } = await supabase
      .from("books")
      .select("*")
      .eq("collection_id", collection.id)
      .order("tome_no", { ascending: true });
    return { collection: collection as Collection, books: (books ?? []) as Book[] };
  });

export const getBookBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: book } = await supabase
      .from("books")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!book) return { book: null, collection: null, segments: [] };
    let collection: Collection | null = null;
    if (book.collection_id) {
      const { data: c } = await supabase
        .from("collections")
        .select("*")
        .eq("id", book.collection_id)
        .maybeSingle();
      collection = (c as Collection) ?? null;
    }
    const { data: segments } = await supabase
      .from("excerpt_segments")
      .select("*")
      .eq("book_id", book.id)
      .eq("is_showcase", true)
      .order("chapter_no", { ascending: true })
      .order("sort_order", { ascending: true });
    return {
      book: book as Book,
      collection,
      segments: (segments ?? []).map(toMirrorSegment),
    };
  });

export const getPageBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: page } = await supabase
      .from("pages")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!page) return { page: null, sections: [] as PageSection[] };
    const { data: sections } = await supabase
      .from("page_sections")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order", { ascending: true });
    return { page: page as Page, sections: (sections ?? []) as PageSection[] };
  });

/** Le passage vitrine : celui qui sert de démonstration du miroir. */
export const getShowcaseSegments = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data: book } = await supabase
    .from("books")
    .select("*")
    .order("tome_no", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!book) return { book: null, collection: null, segments: [] };
  let collection: Collection | null = null;
  if (book.collection_id) {
    const { data: c } = await supabase
      .from("collections")
      .select("*")
      .eq("id", book.collection_id)
      .maybeSingle();
    collection = (c as Collection) ?? null;
  }
  const { data: segments } = await supabase
    .from("excerpt_segments")
    .select("*")
    .eq("book_id", book.id)
    .eq("is_showcase", true)
    .order("chapter_no", { ascending: true })
    .order("sort_order", { ascending: true });
  return { book: book as Book, collection, segments: (segments ?? []).map(toMirrorSegment) };
});
