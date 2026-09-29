import { getCookie, getRequestHost, getRequestUrl } from "@tanstack/react-start/server";
import type { Lang } from "./dictionaries";

export const PREVIEW_COOKIE = "preview_lang";

/** Langue d'un domaine de production, ou null (aperçu, localhost). */
export function productionLang(host: string): Lang | null {
  const h = host.toLowerCase().split(":")[0];
  if (h === "ulpanstory.com" || h === "www.ulpanstory.com") return "en";
  if (h === "oulpanstory.fr" || h === "www.oulpanstory.fr") return "fr";
  return null;
}

/**
 * Langue de la requête en cours, calculée côté serveur (jamais transmise par
 * le navigateur) : domaine en production ; hors production, cookie preview_lang.
 */
export function requestLang(): { lang: Lang; production: boolean } {
  const prod = productionLang(getRequestHost() ?? "");
  if (prod) return { lang: prod, production: true };
  // Hors production : ?lang= de la page demandée (rendu serveur), sinon le cookie.
  let q: string | null = null;
  try { q = getRequestUrl().searchParams.get("lang"); } catch { q = null; }
  if (q === "fr" || q === "en") return { lang: q, production: false };
  return { lang: getCookie(PREVIEW_COOKIE) === "en" ? "en" : "fr", production: false };
}
