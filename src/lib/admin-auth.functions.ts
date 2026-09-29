import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Connexion à l'admin, côté serveur (reprise de l'atelier, même comportement).
 * Les échecs ne sont comptés qu'après une tentative réelle ; seules des
 * empreintes sont stockées. Blocage après 8 échecs en 15 minutes.
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
    const registre = await import("@/lib/public-writes.server");
    const email = data.email.trim().toLowerCase();
    const emailHash = fingerprint(email);
    const ip = callerIp();
    const ipHash = ip ? fingerprint(ip) : null;
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

    // Le registre est un garde-fou : sa panne ne ferme pas la porte.
    const count = async (column: "email_hash" | "ip_hash", value: string) => {
      try {
        return await registre.countLoginFailures(column, value, since);
      } catch (e) {
        console.error("[admin/connexion] lecture du registre impossible", e);
        return 0;
      }
    };
    const tooMany =
      (await count("email_hash", emailHash)) >= MAX_FAILURES ||
      (ipHash ? (await count("ip_hash", ipHash)) >= MAX_FAILURES : false);
    if (tooMany) return { ok: false as const, reason: "throttled" as const };

    const url = process.env["SUPABASE_URL"];
    const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishable) {
      console.error("[admin/connexion] variables serveur manquantes");
      return { ok: false as const, reason: "interne" as const };
    }

    let signIn: Awaited<ReturnType<ReturnType<typeof createClient>["auth"]["signInWithPassword"]>>;
    try {
      const client = createClient(url, publishable, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      signIn = await client.auth.signInWithPassword({ email, password: data.password });
    } catch (e) {
      console.error("[admin/connexion] appel d'authentification en échec", e);
      return { ok: false as const, reason: "interne" as const };
    }

    if (signIn.error || !signIn.data.session) {
      try {
        await registre.recordLoginFailure(emailHash, ipHash);
      } catch (e) {
        console.error("[admin/connexion] écriture du registre impossible", e);
      }
      return { ok: false as const, reason: "refused" as const };
    }

    // Accès réservé aux rôles admin et editor, lus en base.
    const userClient = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signIn.data.session.access_token}` } },
    });
    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", signIn.data.session.user.id);
    const isEditor = (roles ?? []).some((r) => r.role === "admin" || r.role === "editor");
    if (!isEditor) return { ok: false as const, reason: "refused" as const };

    return {
      ok: true as const,
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
    };
  });

/** Vérifie que l'appelant est éditeur (rôle lu en base). Lève « Forbidden » sinon. */
export const adminWhoAmI = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertEditor } = await import("@/lib/editor-context.server");
    await assertEditor(context.supabase, context.userId);
    const email = (context.claims as { email?: string }).email ?? null;
    return { ok: true as const, email };
  });
