import { notFound, redirect, useLoaderData, useParams } from "@tanstack/react-router";
import { tr, type DictKey, type Lang } from "@/i18n/dictionaries";
import { absoluteUrl, pathFor, type PageId } from "@/i18n/routes";
import { seo } from "@/lib/seo";
import { qrEntry } from "@/lib/lecteur.functions";
import type { QrEntry } from "@/lib/public-writes.server";
import { ActivationPage, DesinscriptionPage, EspacePage, QrPage } from "./Pages";

type Ctx = { context: unknown; params?: unknown };
type HeadCtx = { match: { context: unknown }; loaderData?: unknown };
const langOf = (c: { context: unknown }): Lang => ((c.context as { lang?: Lang }).lang ?? "fr");

/** Pages du lecteur : toujours noindex. */
export function lecteurRoute(pageId: PageId, Component: () => React.ReactElement) {
  return {
    staticData: { pageId },
    head: (h: HeadCtx) => {
      const lang = langOf(h.match);
      return seo({ lang, pageId, title: tr(lang, `page.${pageId}` as DictKey), description: tr(lang, "site.description"), noindex: true });
    },
    component: Component,
  };
}
export const activationRoute = () => lecteurRoute("activation", ActivationPage);
export const espaceRoute = () => lecteurRoute("espace_lecteur", EspacePage);
export const desinscriptionRoute = () => lecteurRoute("desinscription", DesinscriptionPage);

export function qrRoute() {
  return {
    staticData: { pageId: "entree_qr" as PageId },
    loader: async (c: Ctx) => {
      const slug = (c.params as { slug: string }).slug;
      const d = await qrEntry({ data: { slug } });
      if (d.kind === "redirect") {
        throw redirect({ href: d.production ? absoluteUrl("entree_qr", d.lang, { slug }) : `${pathFor("entree_qr", d.lang, { slug })}?lang=${d.lang}` });
      }
      if (d.kind !== "ok") throw notFound();
      return d;
    },
    head: (h: HeadCtx) => {
      const lang = langOf(h.match);
      const d = h.loaderData as Extract<QrEntry, { kind: "ok" }> | undefined;
      return { meta: [{ title: `${d?.title ?? d?.titleHe ?? tr(lang, "page.espace_lecteur")} — Ulpan Story` }, { name: "description", content: tr(lang, "lecteur.qrIntro") }, { name: "robots", content: "noindex" }] };
    },
    component: function Qr() {
      const d = useLoaderData({ strict: false }) as Extract<QrEntry, { kind: "ok" }>;
      const { slug } = useParams({ strict: false }) as { slug: string };
      return <QrPage slug={slug} d={d} />;
    },
  };
}
