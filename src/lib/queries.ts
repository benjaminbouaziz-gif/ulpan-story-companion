import { queryOptions } from "@tanstack/react-query";
import type { Lang } from "@/i18n/dictionaries";
import {
  getBookBySlug,
  getCollectionBySlug,
  getCollections,
  getPageBySlug,
  getPublishedBooks,
  getShowcaseSpread,
} from "./catalog.functions";

/** Toutes les lectures publiques portent la langue active : une édition par domaine. */
export const collectionsQuery = (lang: Lang) =>
  queryOptions({
    queryKey: ["collections", lang],
    queryFn: () => getCollections({ data: { lang } }),
  });

export const publishedBooksQuery = (lang: Lang) =>
  queryOptions({
    queryKey: ["books", "published", lang],
    queryFn: () => getPublishedBooks({ data: { lang } }),
  });

export const showcaseQuery = (lang: Lang) =>
  queryOptions({
    queryKey: ["showcase-spread", lang],
    queryFn: () => getShowcaseSpread({ data: { lang } }),
  });

export const collectionQuery = (slug: string, lang: Lang) =>
  queryOptions({
    queryKey: ["collection", slug, lang],
    queryFn: () => getCollectionBySlug({ data: { slug, lang } }),
  });

export const bookQuery = (slug: string, lang: Lang) =>
  queryOptions({
    queryKey: ["book", slug, lang],
    queryFn: () => getBookBySlug({ data: { slug, lang } }),
  });

export const pageQuery = (slug: string, lang: Lang) =>
  queryOptions({
    queryKey: ["page", slug, lang],
    queryFn: () => getPageBySlug({ data: { slug, lang } }),
  });
