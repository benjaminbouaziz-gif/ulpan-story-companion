import { notFound } from "@tanstack/react-router";
import { createElement } from "react";
import { tr, type DictKey, type Lang } from "@/i18n/dictionaries";
import type { PageId } from "@/i18n/routes";
import { seo } from "./seo";
import { ComingSoonPage } from "@/pages/SystemPages";

type HeadCtx = { match: { context: unknown; params: unknown } };
const langOf = (ctx: HeadCtx): Lang => ((ctx.match.context as { lang?: Lang }).lang ?? "fr");

/** Page provisoire « Contenu à venir » (même composant pour les deux langues). */
export function comingSoon(pageId: PageId, opts: { noindex?: boolean } = {}) {
  const titleKey = `page.${pageId}` as DictKey;
  return {
    staticData: { pageId },
    head: (ctx: HeadCtx) => {
      const lang = langOf(ctx);
      return seo({
        lang,
        title: tr(lang, titleKey),
        description: tr(lang, "site.description"),
        pageId,
        noindex: opts.noindex,
      });
    },
    component: () => createElement(ComingSoonPage, { titleKey }),
  };
}

/** Page à construire plus tard : pour l'instant toujours introuvable. */
export function alwaysNotFound(pageId: PageId) {
  return {
    staticData: { pageId },
    loader: () => {
      throw notFound();
    },
    head: (ctx: HeadCtx) => {
      const lang = langOf(ctx);
      return { meta: [{ title: `${tr(lang, "notFound.title")} — Ulpan Story` }, { name: "robots", content: "noindex" }] };
    },
    component: () => null,
  };
}
