import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./admin-spread.server";

/**
 * L'état des lieux : uniquement des comptages lus en base au moment de l'appel.
 * Rien n'est écrit en dur, rien n'est estimé. Un ensemble vide reste vide.
 */
export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      collections,
      books,
      pages,
      bookPages,
      glossary,
      quiz,
      audio,
      editorialPages,
      sections,
      signups,
      profiles,
      access,
      events,
      roles,
    ] = await Promise.all([
      supabaseAdmin.from("collections").select("id, name_fr, slug, is_active"),
      supabaseAdmin
        .from("books")
        .select("id, slug, title_fr, qr_code, status, amazon_url_fr, amazon_url_com, amazon_url_other")
        .order("tome_no", { ascending: true }),
      supabaseAdmin.from("pages").select("id, slug"),
      supabaseAdmin.from("book_pages").select("book_id, support_kind, is_published"),
      supabaseAdmin.from("glossary_entries").select("book_id"),
      supabaseAdmin.from("quiz_questions").select("book_id"),
      supabaseAdmin.from("audio_tracks").select("book_id"),
      supabaseAdmin.from("pages").select("id, slug"),
      supabaseAdmin.from("page_sections").select("page_id, body_fr, body_en, locales"),
      supabaseAdmin.from("email_signups").select("id, confirmed_at"),
      supabaseAdmin.from("profiles").select("user_id"),
      supabaseAdmin.from("book_access").select("id"),
      supabaseAdmin.from("events").select("kind"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const bookRows = books.data ?? [];
    const bookLabel = new Map(bookRows.map((b) => [b.id, b.title_fr]));

    const countBy = <T, K extends string | number>(rows: T[], key: (r: T) => K | null) => {
      const out: Record<string, number> = {};
      for (const r of rows) {
        const k = key(r);
        if (k === null || k === undefined) continue;
        out[String(k)] = (out[String(k)] ?? 0) + 1;
      }
      return out;
    };

    const perBook = bookRows.map((b) => {
      const pagesOfBook = (bookPages.data ?? []).filter((p) => p.book_id === b.id);
      return {
        id: b.id,
        slug: b.slug,
        title: b.title_fr,
        qr_code: b.qr_code,
        status: b.status as string,
        hasAmazon: Boolean(b.amazon_url_fr || b.amazon_url_com || b.amazon_url_other),
        pagesByStage: countBy(pagesOfBook, (p) => p.support_kind as string),
        pagesPublished: pagesOfBook.filter((p) => p.is_published).length,
        pagesTotal: pagesOfBook.length,
        glossary: (glossary.data ?? []).filter((g) => g.book_id === b.id).length,
        quiz: (quiz.data ?? []).filter((q) => q.book_id === b.id).length,
        audio: (audio.data ?? []).filter((a) => a.book_id === b.id).length,
      };
    });

    const pageRows = editorialPages.data ?? [];
    const sectionRows = sections.data ?? [];
    const perPage = pageRows.map((p) => {
      const own = sectionRows.filter((s) => s.page_id === p.id);
      return {
        slug: p.slug,
        sections: own.length,
        missingEnglish: own.filter(
          (s) => (s.locales ?? ["fr", "en"]).includes("en") && !s.body_en?.trim(),
        ).length,
      };
    });

    const roleRows = roles.data ?? [];
    const roleEmails = new Map<string, string | null>();
    for (const r of roleRows) {
      if (roleEmails.has(r.user_id)) continue;
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      roleEmails.set(r.user_id, user.user?.email ?? null);
    }

    return {
      generatedAt: new Date().toISOString(),
      collections: {
        total: (collections.data ?? []).length,
        active: (collections.data ?? []).filter((c) => c.is_active).length,
      },
      booksByStatus: countBy(bookRows, (b) => b.status as string),
      books: perBook,
      pages: perPage,
      readers: {
        signups: (signups.data ?? []).length,
        signupsConfirmed: (signups.data ?? []).filter((s) => s.confirmed_at).length,
        profiles: (profiles.data ?? []).length,
        bookAccess: (access.data ?? []).length,
        eventsByKind: countBy(events.data ?? [], (e) => e.kind as string),
      },
      roles: roleRows.map((r) => ({
        email: roleEmails.get(r.user_id) ?? r.user_id,
        role: r.role as string,
      })),
    };
  });

