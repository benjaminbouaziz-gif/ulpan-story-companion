import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { langFromHost, type Lang } from "./dictionaries";

/**
 * La langue vient du domaine : oulpanstory.fr -> fr, ulpanstory.com -> en.
 * Le lecteur peut la forcer depuis le pied de page (mémorisée côté client).
 */
export const detectLang = createServerFn({ method: "GET" }).handler(
  async (): Promise<Lang> => {
    const host = getRequestHeader("host");
    return langFromHost(host);
  },
);
