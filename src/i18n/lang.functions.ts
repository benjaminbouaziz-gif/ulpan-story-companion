import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHost, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Lang } from "./dictionaries";

const PREVIEW_COOKIE = "preview_lang";

function productionLang(host: string): Lang | null {
  const h = host.toLowerCase().split(":")[0];
  if (h === "ulpanstory.com" || h === "www.ulpanstory.com") return "en";
  if (h === "oulpanstory.fr" || h === "www.oulpanstory.fr") return "fr";
  return null;
}

/**
 * La langue vient du domaine, et de lui seul. Hors production (aperçu,
 * localhost) : ?lang=fr|en, mémorisé dans un cookie de session.
 */
export const detectLang = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ query: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data }): Promise<Lang> => {
    const host = getRequestHost() ?? "";
    const prod = productionLang(host);
    if (prod) return prod;
    if (data.query === "fr" || data.query === "en") {
      setCookie(PREVIEW_COOKIE, data.query, { path: "/", sameSite: "lax", httpOnly: true });
      return data.query;
    }
    const c = getCookie(PREVIEW_COOKIE);
    return c === "en" ? "en" : "fr";
  });
