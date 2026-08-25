import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicClient } from "./catalog.server";
import type { Book, Collection } from "./catalog.functions";
import type { SpreadParagraph } from "./spread";
import { toSpreadParagraph } from "./catalog.server";

/**
 * Le parcours QR. Le QR existe avant le livre : un code inconnu ou réservé
 * répond une page d'attente, jamais une erreur.
 */
export const getQrEntry = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ qr_code: z.string().min(1).max(40) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const code = data.qr_code.trim().toUpperCase();
    const { data: book } = await supabase
      .from("books")
      .select("*")
      .eq("qr_code", code)
      .maybeSingle();
    if (!book)
      return {
        qr_code: code,
        book: null as Book | null,
        collection: null as Collection | null,
        paragraphs: [] as SpreadParagraph[],
      };
    let collection: Collection | null = null;
    if (book.collection_id) {
      const { data: c } = await supabase
        .from("collections")
        .select("*")
        .eq("id", book.collection_id)
        .maybeSingle();
      collection = (c as Collection) ?? null;
    }
    const { data: rows } = await supabase
      .from("spread_paragraphs")
      .select("*")
      .eq("book_id", book.id)
      .order("sort_order", { ascending: true });
    return {
      qr_code: code,
      book: book as Book,
      collection,
      paragraphs: (rows ?? []).map(toSpreadParagraph),
    };
  });

/**
 * Demande d'accès : l'email est enregistré avec la trace du consentement, puis
 * le courrier part. Cliquer le lien (ou saisir le code à six chiffres du même
 * courrier) confirme l'adresse : c'est le double opt-in.
 */
export const requestAccess = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email().max(200),
        qr_code: z.string().max(40).nullable(),
        lang: z.enum(["fr", "en"]).default("fr"),
        consent: z.literal(true),
        redirect_to: z.string().url().max(500),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    let bookId: string | null = null;
    if (data.qr_code) {
      const { data: book } = await supabaseAdmin
        .from("books")
        .select("id")
        .eq("qr_code", data.qr_code.trim().toUpperCase())
        .maybeSingle();
      bookId = book?.id ?? null;
    }
    await supabaseAdmin.from("email_signups").insert({
      email,
      book_id: bookId,
      qr_code: data.qr_code,
      lang: data.lang,
      consent_token: crypto.randomUUID(),
    });
    await supabaseAdmin.from("events").insert({
      book_id: bookId,
      qr_code: data.qr_code,
      kind: "access_requested",
      meta: { lang: data.lang },
    });

    const supabase = publicClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: data.redirect_to, shouldCreateUser: true },
    });
    return { ok: !error, error: error?.message ?? null };
  });

/**
 * Une fois la session ouverte : l'adresse est confirmée, le consentement daté,
 * et l'ouverture du livre enregistrée.
 */
export const confirmAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ qr_code: z.string().max(40).nullable() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await context.supabase.auth.getUser();
    const email = user.user?.email?.toLowerCase() ?? null;
    const now = new Date().toISOString();
    if (email) {
      await supabaseAdmin
        .from("email_signups")
        .update({ confirmed_at: now })
        .is("confirmed_at", null)
        .eq("email", email);
      await context.supabase
        .from("profiles")
        .upsert(
          { user_id: context.userId, email, consent_at: now, consent_source: "qr_double_optin" },
          { onConflict: "user_id" },
        );
    }
    let bookSlug: string | null = null;
    if (data.qr_code) {
      const { data: book } = await supabaseAdmin
        .from("books")
        .select("id, slug")
        .eq("qr_code", data.qr_code.trim().toUpperCase())
        .maybeSingle();
      if (book) {
        bookSlug = book.slug;
        await context.supabase
          .from("book_access")
          .upsert(
            { user_id: context.userId, book_id: book.id, last_seen_at: now },
            { onConflict: "user_id,book_id" },
          );
      }
    }
    return { ok: true, bookSlug };
  });
