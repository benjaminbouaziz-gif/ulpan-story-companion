import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { z } from "zod";

/**
 * Une seule porte : la connexion se fait ICI, côté serveur. Le comptage des
 * échecs n'est écrit qu'après une tentative réelle, jamais sur déclaration du
 * client : un tiers ne peut donc pas fermer l'accès de quelqu'un d'autre.
 * Aucune adresse email n'est stockée en clair, seulement une empreinte.
 */
const WINDOW_MINUTES = 15;
const MAX_FAILURES = 8;
const PEPPER = "ulpanstory.atelier.login.v1";

const input = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

function fingerprint(value: string) {
  return createHash("sha256").update(`${PEPPER}:${value}`).digest("hex");
}

function callerIp() {
  const forwarded = getRequestHeader("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || getRequestHeader("cf-connecting-ip") || getRequestHeader("x-real-ip") || null;
}

export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const emailHash = fingerprint(email);
    const ip = callerIp();
    const ipHash = ip ? fingerprint(ip) : null;
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

    const countFailures = async (column: "email_hash" | "ip_hash", value: string) => {
      const { count } = await supabaseAdmin
        .from("admin_login_attempts")
        .select("id", { count: "exact", head: true })
        .eq(column, value)
        .gte("created_at", since);
      return count ?? 0;
    };

    const tooMany =
      (await countFailures("email_hash", emailHash)) >= MAX_FAILURES ||
      (ipHash ? (await countFailures("ip_hash", ipHash)) >= MAX_FAILURES : false);
    if (tooMany) return { ok: false as const, reason: "throttled" as const };

    const client = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: signIn, error } = await client.auth.signInWithPassword({
      email,
      password: data.password,
    });

    if (error || !signIn.session) {
      await supabaseAdmin
        .from("admin_login_attempts")
        .insert({ email_hash: emailHash, ip_hash: ipHash });
      return { ok: false as const, reason: "refused" as const };
    }

    return {
      ok: true as const,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });
