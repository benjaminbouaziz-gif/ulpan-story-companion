import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";

/**
 * Lecture seule du squelette de fabrication. Ces tables n'ont AUCUN accès
 * client : tout passe ici, et le client de service ne s'obtient qu'avec un
 * EditorContext, produit uniquement par assertEditor (rôle lu en base).
 * Aucun chiffre n'est écrit en dur : tout est compté au moment de l'appel.
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
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const [books, collections, steps] = await Promise.all([
      admin
        .from("books")
        .select("id, slug, title_fr, status, collection_id, current_step_code")
        .order("tome_no", { ascending: true }),
      admin.from("collections").select("id, name_fr"),
      admin.from("book_steps").select("book_id, step_code, label_fr, status, lang").in("lang", ["shared", "fr"]),
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
  lang: string;
  note: string | null;
};

/**
 * AXE LANGUE EN SOMMEIL. Les colonnes `lang` (book_steps) et `langs`
 * (step_templates) restent en base, mais rien ne les montre à l'écran et
 * l'instanciation d'une chaîne ne crée que l'édition française.
 *
 * La chaîne anglaise est INCOMPLÈTE en l'état : neuf étapes sont dédoublées
 * en fr/en, mais AUCUNE étape ne produit le texte de soutien anglais. Les
 * pages de soutien ne se traduisent jamais automatiquement : ce sont des
 * constructions pédagogiques distinctes. L'étape manquante sera ajoutée
 * quand une édition anglaise sera décidée.
 */
const LANGS_VISIBLES = ["shared", "fr"] as const;

export const atelierBookChain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<AtelierStepRow[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: rows } = await admin
      .from("book_steps")
      .select("id, rank, step_code, label_fr, label_en, species, status, awaiting, lang, note")
      .eq("book_id", data.bookId)
      .in("lang", LANGS_VISIBLES as unknown as string[])
      .order("rank", { ascending: true })
      .order("lang", { ascending: true });

    return (rows ?? []).map((r) => ({
      id: r.id,
      rank: r.rank,
      code: r.step_code,
      labelFr: r.label_fr,
      labelEn: r.label_en,
      species: r.species,
      status: r.status,
      awaiting: r.awaiting ?? null,
      lang: r.lang,
      note: r.note ?? null,
    }));
  });
