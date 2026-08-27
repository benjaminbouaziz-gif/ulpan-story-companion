import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Limitation des tentatives de connexion : les échecs sont écrits dans la table
 * `events` (aucune table nouvelle) et comptés côté serveur. Cinq échecs pour une
 * même adresse en quinze minutes ferment la porte.
 */
const WINDOW_MINUTES = 15;
const MAX_FAILURES = 5;

const emailInput = z.object({ email: z.string().email().max(200) });

export const adminLoginAllowed = createServerFn({ method: "POST" })
  .inputValidator((data) => emailInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "admin_login_failed")
      .eq("meta->>email", data.email.trim().toLowerCase())
      .gte("created_at", since);
    return { allowed: (count ?? 0) < MAX_FAILURES };
  });

export const adminLoginFailed = createServerFn({ method: "POST" })
  .inputValidator((data) => emailInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("events").insert({
      kind: "admin_login_failed",
      meta: { email: data.email.trim().toLowerCase() },
    });
    return { ok: true };
  });
