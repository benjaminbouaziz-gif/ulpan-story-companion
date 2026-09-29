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

export async function sitemapXml(lang: Lang): Promise<string> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { sitemapEntries } = await import("@/lib/vitrine.data");
  const e = await sitemapEntries(supabase, lang);
  const loc = (href: string, lastmod?: string) =>
    `  <url><loc>${href}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}</url>`;
  const urls = [
    ...SITEMAP_PAGES.map((id) => loc(absoluteUrl(id, lang))),
    ...e.collections.map((c) => loc(absoluteUrl("collection", lang, { slug: c.slug }), c.updatedAt)),
    ...e.books.map((b) => loc(absoluteUrl("livre", lang, { slug: b.slug }), b.updatedAt)),
  ].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
