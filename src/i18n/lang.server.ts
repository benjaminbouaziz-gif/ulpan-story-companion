import { getCookie, getRequestHost } from "@tanstack/react-start/server";
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
  return { lang: getCookie(PREVIEW_COOKIE) === "en" ? "en" : "fr", production: false };
}
