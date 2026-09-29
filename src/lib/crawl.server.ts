import type { Lang } from "@/i18n/dictionaries";
import { DOMAINS, absoluteUrl, type PageId } from "@/i18n/routes";

/** Langue d'une requête de robot : domaine de production, sinon ?lang=, sinon cookie, sinon fr. */
export function crawlLang(request: Request): Lang {
  const url = new URL(request.url);
  const host = (request.headers.get("host") ?? url.host).toLowerCase().split(":")[0];
  if (host === "ulpanstory.com" || host === "www.ulpanstory.com") return "en";
  if (host === "oulpanstory.fr" || host === "www.oulpanstory.fr") return "fr";
  const q = url.searchParams.get("lang");
  if (q === "en" || q === "fr") return q;
  return /(?:^|;\s*)preview_lang=en/.test(request.headers.get("cookie") ?? "") ? "en" : "fr";
}

export function robotsTxt(lang: Lang): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /activation",
    "Disallow: /compagnon",
    "Disallow: /companion",
    "Disallow: /desinscription",
    "Disallow: /unsubscribe",
    "",
    `Sitemap: ${DOMAINS[lang]}/sitemap.xml`,
    "",
  ].join("\n");
}

const SITEMAP_PAGES: PageId[] = ["accueil", "methode", "collections", "contact", "mentions", "confidentialite"];

export function sitemapXml(lang: Lang): string {
  const urls = SITEMAP_PAGES.map((id) => `  <url><loc>${absoluteUrl(id, lang)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
