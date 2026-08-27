import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./admin-spread.server";

/**
 * Lecture seule du squelette de fabrication. Ces tables n'ont AUCUN accès
 * client : tout passe ici, et la première ligne de chaque handler vérifie le
 * rôle en base (assertEditor). Aucun chiffre n'est écrit en dur : tout est
 * compté au moment de l'appel.
 */

export type AtelierBookRow = {
  id: string;
  title: string;
  slug: string;
  collection: string | null;
  status: string;
  currentStepCode: string | null;
  currentStepLabelFr: string | null;
  stepsValidated: number;
  stepsTotal: number;
};

export const atelierBooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AtelierBookRow[]> => {
    await assertEditor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [books, collections, steps] = await Promise.all([
      supabaseAdmin
        .from("books")
        .select("id, slug, title_fr, status, collection_id, current_step_code")
        .order("tome_no", { ascending: true }),
      supabaseAdmin.from("collections").select("id, name_fr"),
      supabaseAdmin.from("book_steps").select("book_id, step_code, label_fr, status"),
    ]);

    const names = new Map((collections.data ?? []).map((c) => [c.id, c.name_fr]));
    const stepRows = steps.data ?? [];

    return (books.data ?? []).map((b) => {
      const own = stepRows.filter((s) => s.book_id === b.id);
      const current = own.find((s) => s.step_code === b.current_step_code);
      return {
        id: b.id,
        title: b.title_fr,
        slug: b.slug,
        collection: b.collection_id ? (names.get(b.collection_id) ?? null) : null,
        status: b.status as string,
        currentStepCode: b.current_step_code ?? null,
        currentStepLabelFr: current?.label_fr ?? null,
        stepsValidated: own.filter((s) => s.status === "valide" || s.status === "valide_hors_crm").length,
        stepsTotal: own.length,
      };
    });
  });

export type AtelierStepRow = {
  id: string;
  rank: number;
  code: string;
  labelFr: string;
  labelEn: string;
  species: string;
  status: string;
  awaiting: string | null;
};

export const atelierBookChain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<AtelierStepRow[]> => {
    await assertEditor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("book_steps")
      .select("id, rank, step_code, label_fr, label_en, species, status, awaiting")
      .eq("book_id", data.bookId)
      .order("rank", { ascending: true });

    return (rows ?? []).map((r) => ({
      id: r.id,
      rank: r.rank,
      code: r.step_code,
      labelFr: r.label_fr,
      labelEn: r.label_en,
      species: r.species,
      status: r.status,
      awaiting: r.awaiting ?? null,
    }));
  });
