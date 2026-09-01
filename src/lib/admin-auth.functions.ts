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
    const email = data.email.trim().toLowerCase();
    const emailHash = fingerprint(email);
    const ip = callerIp();
    const ipHash = ip ? fingerprint(ip) : null;
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

    /**
     * Le registre des tentatives est un GARDE-FOU, pas la porte elle-même :
     * s'il tombe en panne (clé serveur absente, droits manquants), la connexion
     * doit continuer et la panne être écrite dans le journal — jamais déguisée
     * en « identifiant incorrect ».
     */
    type Registre = typeof import("@/integrations/supabase/client.server").supabaseAdmin;
    let registre: Registre | null = null;
    try {
      registre = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    } catch (e) {
      console.error("[atelier/connexion] registre des tentatives indisponible", e);
    }

    const countFailures = async (column: "email_hash" | "ip_hash", value: string) => {
      if (!registre) return 0;
      const { count, error } = await registre
        .from("admin_login_attempts")
        .select("id", { count: "exact", head: true })
        .eq(column, value)
        .gte("created_at", since);
      if (error) {
        console.error("[atelier/connexion] lecture du registre impossible", error);
        return 0;
      }
      return count ?? 0;
    };

    try {
      const tooMany =
        (await countFailures("email_hash", emailHash)) >= MAX_FAILURES ||
        (ipHash ? (await countFailures("ip_hash", ipHash)) >= MAX_FAILURES : false);
      if (tooMany) return { ok: false as const, reason: "throttled" as const };
    } catch (e) {
      console.error("[atelier/connexion] comptage des échecs impossible", e);
    }

    const url = process.env["SUPABASE_URL"];
    const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishable) {
      console.error(
        "[atelier/connexion] variables serveur manquantes : " +
          [!url ? "SUPABASE_URL" : null, !publishable ? "SUPABASE_PUBLISHABLE_KEY" : null]
            .filter(Boolean)
            .join(", "),
      );
      return { ok: false as const, reason: "interne" as const };
    }

    let signIn: Awaited<ReturnType<ReturnType<typeof createClient>["auth"]["signInWithPassword"]>>;
    try {
      const client = createClient(url, publishable, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      signIn = await client.auth.signInWithPassword({ email, password: data.password });
    } catch (e) {
      console.error("[atelier/connexion] appel d'authentification en échec", e);
      return { ok: false as const, reason: "interne" as const };
    }

    if (signIn.error || !signIn.data.session) {
      // Le registre ne doit jamais faire échouer la réponse : s'il tombe, on
      // l'écrit dans le journal et la réponse reste « identifiants refusés ».
      try {
        if (registre) {
          const { error } = await registre
            .from("admin_login_attempts")
            .insert({ email_hash: emailHash, ip_hash: ipHash });
          if (error) console.error("[atelier/connexion] écriture du registre impossible", error);
        }
      } catch (e) {
        console.error("[atelier/connexion] écriture du registre impossible", e);
      }
      return { ok: false as const, reason: "refused" as const };
    }

    return {
      ok: true as const,
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
    };
  });

