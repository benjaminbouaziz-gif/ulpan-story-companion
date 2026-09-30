import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Parcours lecteur (entrée QR, accès, activation, espace lecteur,
 * désinscription). La langue est TOUJOURS recalculée côté serveur à partir du
 * domaine ; toute lecture non publique et toute écriture passent par
 * public-writes.server.ts.
 */
const slug = z.string().trim().min(1).max(80);
const email = z.string().trim().min(3).max(254);

async function ctx() {
  const { requestLang } = await import("@/i18n/lang.server");
  const fwd = (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim();
  const ip = fwd || getRequestHeader("cf-connecting-ip") || getRequestHeader("x-real-ip") || "inconnue";
  return { ...requestLang(), ip };
}
const pw = () => import("@/lib/public-writes.server");

function emailOf(claims: unknown): string {
  const e = (claims as { email?: string } | null)?.email;
  if (!e) throw new Error("NO_EMAIL");
  return e;
}

export const qrEntry = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug }).parse(d))
  .handler(async ({ data }) => {
    const { lang, production } = await ctx();
    const w = await pw();
    const q = await w.getQrEntry(data.slug, lang);
    if (q.kind === "ok") {
      const purpose = [getRequestHeader("purpose"), getRequestHeader("sec-purpose")].join(" ");
      const name = `qr_${q.editionId}`;
      if (!getCookie(name) && !/prefetch|prerender/i.test(purpose)) {
        setCookie(name, "1", { path: "/", maxAge: 3600, sameSite: "lax", httpOnly: true, secure: true });
        await w.recordQrScan(q.editionId, getRequestHeader("user-agent") ?? null);
      }
    }
    return { ...q, production };
  });

export const demanderAcces = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug, email, newsOptout: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const c = await ctx();
    return { result: await (await pw()).requestAccess({ ...data, lang: c.lang, production: c.production, ip: c.ip }) };
  });

export const rejoindreAttente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug, email, newsOptout: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const c = await ctx();
    return { result: await (await pw()).joinWaitlist({ ...data, lang: c.lang, ip: c.ip }) };
  });

export const lienConnexion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email, editionId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const c = await ctx();
    return { result: await (await pw()).sendLoginLink({ email: data.email, editionId: data.editionId, lang: c.lang, production: c.production, ip: c.ip }) };
  });

export const entrerConnecte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug }).parse(d))
  .handler(async ({ context, data }) => {
    const { lang } = await ctx();
    return { status: await (await pw()).qrEnterAsReader(context.userId, data.slug, lang) };
  });

export const attenteConnecte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug }).parse(d))
  .handler(async ({ context, data }) => {
    const { lang } = await ctx();
    return { result: await (await pw()).joinWaitlistAsReader(context.userId, emailOf(context.claims), data.slug, lang) };
  });

export const confirmerAcces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ editionId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ context, data }) => (await pw()).confirmAccess(context.userId, emailOf(context.claims), data.editionId));

export const monEspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await pw()).readerSpace(context.userId, emailOf(context.claims)));

export const regleNouveautes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ on: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await (await pw()).setReaderNews(context.userId, data.on);
    return { ok: true };
  });

export const supprimerMonCompte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ confirmation: z.enum(["SUPPRIMER", "DELETE"]) }).parse(d))
  .handler(async ({ context }) => ({ result: await (await pw()).eraseReader(context.userId) }));

export const desinscrire = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => ({ ok: await (await pw()).unsubscribeByToken(data.token) }));
