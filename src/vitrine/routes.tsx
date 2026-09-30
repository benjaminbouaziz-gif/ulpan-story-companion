import { notFound, useLoaderData } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { tr, type DictKey, type Lang } from "@/i18n/dictionaries";
import type { PageId } from "@/i18n/routes";
import { seo } from "@/lib/seo";
import type { PageKey } from "@/lib/site-blocks";
import type { BlocksPageData, BookData, CollectionData, HomeData, VBlock, VCollCard } from "@/lib/vitrine.data";
import { clickAmazon, getBlocksPage, getBook, getCollection, getCollections, getHome } from "@/lib/vitrine.functions";
import { BookPage, CollectionPage, CollectionsPage, HomePage, MethodPage, SimplePage } from "./Pages";

/** Options de route des pages de la vitrine (FR et EN partagent le même builder). */

type Ctx = { context: unknown; params?: unknown };
type HeadCtx = { match: { context: unknown }; loaderData?: unknown; params: unknown };
const langOf = (c: { context: unknown }): Lang => ((c.context as { lang?: Lang }).lang ?? "fr");
const slugOf = (c: { params?: unknown }) => (c.params as { slug: string }).slug;

const cut = (s: string, n = 160) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");
function fromBlocks(blocks: VBlock[]) {
  return { title: blocks.find((b) => b.kind === "titre" && b.title)?.title ?? null, text: blocks.find((b) => b.kind === "texte" && b.body)?.body ?? null };
}
const notFoundHead = (lang: Lang) => ({ meta: [{ title: `${tr(lang, "notFound.title")} — Ulpan Story` }, { name: "robots", content: "noindex" }] });

export function homeRoute() {
  return {
    staticData: { pageId: "accueil" as PageId },
    loader: (c: Ctx) => getHome({ data: { lang: langOf(c) } }),
    head: (h: HeadCtx) => {
      const lang = langOf(h.match);
      const d = h.loaderData as HomeData | undefined;
      const f = fromBlocks(d?.ouverture ?? []);
      return seo({ lang, pageId: "accueil", title: f.title ?? tr(lang, "page.accueil"), description: cut(f.text ?? tr(lang, "site.description")) });
    },
    component: function Home() {
      const click = useServerFn(clickAmazon);
      const onAmazon = (editionId: string) => {
        if (!/(?:^|; )us_vid=/.test(document.cookie)) {
          document.cookie = `us_vid=${crypto.randomUUID()}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        }
        void click({ data: { editionId } }).catch(() => {});
      };
      return <HomePage d={useLoaderData({ strict: false }) as HomeData} onAmazon={onAmazon} />;
    },
  };
}

export function blocksRoute(pageId: "methode" | "contact" | "mentions" | "confidentialite", pageKey: PageKey) {
  const titleKey = `page.${pageId}` as DictKey;
  const withSteps = pageId === "methode";
  return {
    staticData: { pageId },
    loader: (c: Ctx) => getBlocksPage({ data: { lang: langOf(c), pageKey, withSteps } }),
    head: (h: HeadCtx) => {
      const lang = langOf(h.match);
      const f = fromBlocks((h.loaderData as BlocksPageData | undefined)?.blocks ?? []);
      return seo({ lang, pageId, title: f.title ?? tr(lang, titleKey), description: cut(f.text ?? tr(lang, "site.description")) });
    },
    component: function Page() {
      const d = useLoaderData({ strict: false }) as BlocksPageData;
      return withSteps ? <MethodPage d={d} /> : <SimplePage d={d} titleKey={titleKey} />;
    },
  };
}

export function collectionsRoute() {
  return {
    staticData: { pageId: "collections" as PageId },
    loader: (c: Ctx) => getCollections({ data: { lang: langOf(c) } }),
    head: (h: HeadCtx) => {
      const lang = langOf(h.match);
      return seo({ lang, pageId: "collections", title: tr(lang, "page.collections"), description: tr(lang, "site.description") });
    },
    component: function Collections() {
      return <CollectionsPage d={useLoaderData({ strict: false }) as { collections: VCollCard[] }} />;
    },
  };
}

export function collectionRoute() {
  return {
    staticData: { pageId: "collection" as PageId },
    loader: async (c: Ctx) => {
      const d = await getCollection({ data: { lang: langOf(c), slug: slugOf(c) } });
      if (!d) throw notFound();
      return d;
    },
    head: (h: HeadCtx) => {
      const lang = langOf(h.match);
      const d = h.loaderData as CollectionData | undefined;
      if (!d) return notFoundHead(lang);
      return seo({ lang, pageId: "collection", params: { slug: d.slug }, title: d.name, description: cut(d.tagline ?? tr(lang, "site.description")), alternateExists: d.alternateExists });
    },
    component: function Collection() {
      return <CollectionPage d={useLoaderData({ strict: false }) as CollectionData} />;
    },
  };
}

export function bookRoute() {
  return {
    staticData: { pageId: "livre" as PageId },
    loader: async (c: Ctx) => {
      const d = await getBook({ data: { lang: langOf(c), slug: slugOf(c) } });
      if (!d) throw notFound();
      return d;
    },
    head: (h: HeadCtx) => {
      const lang = langOf(h.match);
      const d = h.loaderData as BookData | undefined;
      if (!d) return notFoundHead(lang);
      const r = seo({ lang, pageId: "livre", params: { slug: d.slug }, title: d.title, description: cut(d.blurb ?? tr(lang, "site.description")), image: d.coverUrl ?? undefined, alternateExists: d.alternateExists });
      return { ...r, meta: r.meta.map((m) => (m["property"] === "og:type" ? { property: "og:type", content: "book" } : m)) };
    },
    component: function Book() {
      const d = useLoaderData({ strict: false }) as BookData;
      const click = useServerFn(clickAmazon);
      const onAmazon = () => {
        // Identifiant anonyme de session créé avant l'appel, pour que des clics rapides partagent le même.
        if (!/(?:^|; )us_vid=/.test(document.cookie)) {
          document.cookie = `us_vid=${crypto.randomUUID()}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        }
        void click({ data: { editionId: d.editionId } }).catch(() => {});
      };
      return <BookPage d={d} onAmazon={onAmazon} />;
    },
  };
}
