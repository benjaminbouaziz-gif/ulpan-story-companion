import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHost, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Lang } from "./dictionaries";
import { PREVIEW_COOKIE, productionLang } from "./lang.server";

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
