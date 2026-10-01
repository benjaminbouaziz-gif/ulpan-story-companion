import type { Lang } from "./dictionaries";

/** Table unique des adresses publiques. Tous les liens passent par pathFor. */
export const ROUTES = {
  accueil: { fr: "/", en: "/" },
  methode: { fr: "/methode", en: "/method" },
  collections: { fr: "/collections", en: "/collections" },
  collection: { fr: "/collections/$slug", en: "/collections/$slug" },
  livre: { fr: "/livres/$slug", en: "/books/$slug" },
  entree_qr: { fr: "/$slug", en: "/$slug" },
  activation: { fr: "/activation", en: "/activation" },
  espace_lecteur: { fr: "/compagnon", en: "/companion" },
  compagnon: { fr: "/compagnon/$slug", en: "/companion/$slug" },
  desinscription: { fr: "/desinscription", en: "/unsubscribe" },
  contact: { fr: "/contact", en: "/contact" },
  mentions: { fr: "/mentions-legales", en: "/legal" },
  confidentialite: { fr: "/confidentialite", en: "/privacy" },
} as const satisfies Record<string, Record<Lang, string>>;

export type PageId = keyof typeof ROUTES;
export type RouteParams = Record<string, string>;

export const DOMAINS: Record<Lang, string> = {
  fr: "https://oulpanstory.fr",
  en: "https://ulpanstory.com",
};

export const RESERVED_SLUGS = [
  "methode", "method", "collections", "livres", "books", "activation", "compagnon",
  "companion", "desinscription", "unsubscribe", "contact", "mentions-legales", "legal",
  "confidentialite", "privacy", "admin", "api", "lovable", "b", "sitemap.xml", "robots.txt",
] as const;

export function pathFor(id: PageId, lang: Lang, params: RouteParams = {}): string {
  return ROUTES[id][lang].replace(/\$(\w+)/g, (_, k: string) => encodeURIComponent(params[k] ?? ""));
}

export function absoluteUrl(id: PageId, lang: Lang, params: RouteParams = {}): string {
  const p = pathFor(id, lang, params);
  return DOMAINS[lang] + (p === "/" ? "/" : p);
}

function toRegex(pattern: string): RegExp {
  const src = pattern.replace(/\$(\w+)/g, "(?<$1>[^/]+)");
  return new RegExp(`^${src}/?$`);
}

/**
 * Si le chemin appartient à l'autre langue (et pas à celle-ci), renvoie
 * l'équivalent dans la langue donnée. Sinon null.
 */
export function redirectTarget(pathname: string, lang: Lang): string | null {
  const other: Lang = lang === "fr" ? "en" : "fr";
  for (const id of Object.keys(ROUTES) as PageId[]) {
    const r = ROUTES[id];
    if (r.fr === r.en) continue;
    const m = toRegex(r[other]).exec(pathname);
    if (m && !toRegex(r[lang]).test(pathname)) {
      const params = Object.fromEntries(
        Object.entries(m.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]),
      );
      return pathFor(id, lang, params);
    }
  }
  return null;
}

/** Lien vers la même page dans l'autre langue : autre domaine en production, ?lang= ailleurs. */
/** Vrai sur un domaine de production (oulpanstory.fr, ulpanstory.com, www compris). */
export function estProduction(host: string): boolean {
  const h = host.toLowerCase().split(":")[0] ?? "";
  return /(^|\.)(ulpanstory\.com|oulpanstory\.fr)$/.test(h);
}

export function otherLangHref(id: PageId, lang: Lang, params: RouteParams = {}, host = ""): string {
  const o: Lang = lang === "fr" ? "en" : "fr";
  return estProduction(host) ? absoluteUrl(id, o, params) : `${pathFor(id, o, params)}?lang=${o}`;
}
