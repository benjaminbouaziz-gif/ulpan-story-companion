import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  loadBookPages,
  loadGlossaryWords,
  publicClient,
  toGlossaryItem,
  toSpreadParagraph,
} from "./catalog.server";
import type { BookPage, GlossaryWord } from "./book-page";
import type { GlossaryItem, SpreadParagraph } from "./spread";

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
    if (!collection)
      return {
        collection: null as Collection | null,
        books: [] as Book[],
        firstBook: null as Book | null,
        paragraphs: [] as SpreadParagraph[],
      };
    const { data: books } = await supabase
      .from("books")
      .select("*")
      .eq("collection_id", collection.id)
      .order("tome_no", { ascending: true });
    const list = (books ?? []) as Book[];
    const first = list[0] ?? null;
    let paragraphs: SpreadParagraph[] = [];
    if (first) {
      const { data: rows } = await supabase
        .from("spread_paragraphs")
        .select("*")
        .eq("book_id", first.id)
        .order("sort_order", { ascending: true });
      paragraphs = (rows ?? []).map(toSpreadParagraph);
    }
    return {
      collection: collection as Collection | null,
      books: list,
      firstBook: first,
      paragraphs,
    };
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
    if (!book)
      return {
        book: null as Book | null,
        collection: null as Collection | null,
        paragraphs: [] as SpreadParagraph[],
        glossary: [] as GlossaryItem[],
      };
    let collection: Collection | null = null;
    if (book.collection_id) {
      const { data: c } = await supabase
        .from("collections")
        .select("*")
        .eq("id", book.collection_id)
        .maybeSingle();
      collection = (c as Collection) ?? null;
    }
    const [{ data: rows }, { data: gloss }] = await Promise.all([
      supabase
        .from("spread_paragraphs")
        .select("*")
        .eq("book_id", book.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("glossary_entries")
        .select("*")
        .eq("book_id", book.id)
        .order("sort_order", { ascending: true }),
    ]);
    return {
      book: book as Book | null,
      collection,
      paragraphs: (rows ?? []).map(toSpreadParagraph),
      glossary: (gloss ?? []).map(toGlossaryItem),
    };
  });

export type SpreadBundle = {
  book: Book;
  collection: Collection | null;
  paragraphs: SpreadParagraph[];
};

export const getPageBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const empty = {
      page: null as Page | null,
      sections: [] as PageSection[],
      books: {} as Record<string, Book>,
      colors: {} as Record<string, string | null>,
      spreads: {} as Record<string, SpreadBundle>,
    };
    const { data: page } = await supabase
      .from("pages")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!page) return empty;
    const { data: sectionRows } = await supabase
      .from("page_sections")
      .select("*")
      .eq("page_id", page.id)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true });
    const sections = (sectionRows ?? []) as PageSection[];

    // Les sections qui parlent d'un livre : on charge ce livre une seule fois.
    const bookIds = Array.from(
      new Set(
        sections
          .map((s) => (s.data as { book_id?: string } | null)?.book_id)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    );
    const books: Record<string, Book> = {};
    const colors: Record<string, string | null> = {};
    const spreads: Record<string, SpreadBundle> = {};
    if (bookIds.length > 0) {
      const { data: bookRows } = await supabase.from("books").select("*").in("id", bookIds);
      for (const b of (bookRows ?? []) as Book[]) books[b.id] = b;

      const collectionIds = Array.from(
        new Set(
          Object.values(books)
            .map((b) => b.collection_id)
            .filter((v): v is string => typeof v === "string"),
        ),
      );
      const collections: Record<string, Collection> = {};
      if (collectionIds.length > 0) {
        const { data: rows } = await supabase
          .from("collections")
          .select("*")
          .in("id", collectionIds);
        for (const c of (rows ?? []) as Collection[]) collections[c.id] = c;
      }
      for (const b of Object.values(books)) {
        colors[b.id] = (b.collection_id ? collections[b.collection_id]?.color_hex : null) ?? null;
      }

      const spreadIds = sections
        .filter((s) => s.kind === "book_spread")
        .map((s) => (s.data as { book_id?: string } | null)?.book_id)
        .filter((v): v is string => typeof v === "string" && !!books[v]);
      for (const id of Array.from(new Set(spreadIds))) {
        const book = books[id]!;
        const { data: rows } = await supabase
          .from("spread_paragraphs")
          .select("*")
          .eq("book_id", id)
          .order("sort_order", { ascending: true });
        spreads[id] = {
          book,
          collection: (book.collection_id ? collections[book.collection_id] : null) ?? null,
          paragraphs: (rows ?? []).map(toSpreadParagraph),
        };
      }
    }

    return { page: page as Page | null, sections, books, colors, spreads };

  });


/** La double page de référence : celle du premier tome publié. */
export const getShowcaseSpread = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data: book } = await supabase
    .from("books")
    .select("*")
    .order("tome_no", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!book)
    return {
      book: null as Book | null,
      collection: null as Collection | null,
      paragraphs: [] as SpreadParagraph[],
    };
  let collection: Collection | null = null;
  if (book.collection_id) {
    const { data: c } = await supabase
      .from("collections")
      .select("*")
      .eq("id", book.collection_id)
      .maybeSingle();
    collection = (c as Collection) ?? null;
  }
  const { data: rows } = await supabase
    .from("spread_paragraphs")
    .select("*")
    .eq("book_id", book.id)
    .order("sort_order", { ascending: true });
  return {
    book: book as Book | null,
    collection,
    paragraphs: (rows ?? []).map(toSpreadParagraph),
  };
});
