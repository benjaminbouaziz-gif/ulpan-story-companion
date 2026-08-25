import { queryOptions } from "@tanstack/react-query";
import {
  getBookBySlug,
  getCollectionBySlug,
  getCollections,
  getPageBySlug,
  getPublishedBooks,
  getShowcaseExcerpt,
} from "./catalog.functions";

export const collectionsQuery = queryOptions({
  queryKey: ["collections"],
  queryFn: () => getCollections(),
});

export const publishedBooksQuery = queryOptions({
  queryKey: ["books", "published"],
  queryFn: () => getPublishedBooks(),
});

export const showcaseQuery = queryOptions({
  queryKey: ["showcase-excerpt"],
  queryFn: () => getShowcaseExcerpt(),
});

export const collectionQuery = (slug: string) =>
  queryOptions({
    queryKey: ["collection", slug],
    queryFn: () => getCollectionBySlug({ data: { slug } }),
  });

export const bookQuery = (slug: string) =>
  queryOptions({
    queryKey: ["book", slug],
    queryFn: () => getBookBySlug({ data: { slug } }),
  });

export const pageQuery = (slug: string) =>
  queryOptions({
    queryKey: ["page", slug],
    queryFn: () => getPageBySlug({ data: { slug } }),
  });
