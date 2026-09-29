import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/** Phrase de marque du pied de page (site_blocks 'pied', langue donnée). Vide → null. */
export const getFooterTagline = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ lang: z.enum(["fr", "en"]) }).parse(d))
  .handler(async ({ data }): Promise<string | null> => {
    const { data: row } = await supabase
      .from("site_blocks")
      .select("body")
      .eq("page_key", "pied")
      .eq("lang", data.lang)
      .eq("kind", "texte")
      .eq("is_visible", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    const body = row?.body?.trim();
    return body ? body : null;
  });
