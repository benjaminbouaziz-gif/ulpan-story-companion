import type { Lang } from "@/i18n/dictionaries";
import { absoluteUrl, type PageId, type RouteParams } from "@/i18n/routes";

type SeoInput = {
  lang: Lang;
  title: string;
  description: string;
  pageId: PageId;
  params?: RouteParams;
  /** La page existe-t-elle dans l'autre langue ? */
  alternateExists?: boolean;
  image?: string | undefined;
  noindex?: boolean | undefined;
};

export function seo({ lang, title, description, pageId, params = {}, alternateExists = true, image, noindex }: SeoInput) {
  const full = `${title} — Ulpan Story`;
  const other: Lang = lang === "fr" ? "en" : "fr";
  const meta: Array<Record<string, string>> = [
    { title: full },
    { name: "description", content: description },
    { property: "og:title", content: full },
    { property: "og:description", content: description },
    { property: "og:locale", content: lang === "fr" ? "fr_FR" : "en_US" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
  ];
  if (image) {
    meta.push({ property: "og:image", content: image }, { name: "twitter:image", content: image });
  }
  if (noindex) meta.push({ name: "robots", content: "noindex" });

  const links: Array<Record<string, string>> = [
    { rel: "canonical", href: absoluteUrl(pageId, lang, params) },
  ];
  if (alternateExists) {
    links.push(
      { rel: "alternate", hrefLang: lang, href: absoluteUrl(pageId, lang, params) },
      { rel: "alternate", hrefLang: other, href: absoluteUrl(pageId, other, params) },
      { rel: "alternate", hrefLang: "x-default", href: absoluteUrl(pageId, "fr", params) },
    );
  } else {
    links.push({ rel: "alternate", hrefLang: "x-default", href: absoluteUrl(pageId, lang, params) });
  }
  return { meta, links };
}
