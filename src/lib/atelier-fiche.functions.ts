import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";

/**
 * BRIQUE 5 — LA FICHE LIVRE.
 *
 * La porte d'entrée de la chaîne : un livre naît ici, jamais par migration.
 * Trois invariants tenus par ce fichier :
 *  - un livre naît EN FABRICATION ('idea'), jamais 'published' : le site
 *    public ne lit que les livres publiés, donc il n'en voit rien ;
 *  - `qr_reserved_at` reste vide à la création : cette date marque la vraie
 *    réservation, au montage, quand le code part à l'imprimeur ;
 *  - `current_step_code` n'est JAMAIS écrit ici : un déclencheur le dérive.
 *
 * L'axe langue reste en sommeil : `instancier_chaine` ne crée que l'édition
 * française, et aucun sélecteur de langue n'apparaît.
 *
 * Le journal de la fiche vit dans `content_versions` (entity = 'book_fiche') :
 * une ligne par modification, avec l'instantané des champs touchés. Il se lit
 * dans le dossier de l'étape « Fiche du livre », comme un dépôt.
 */

export const FICHE_STEP_CODE = "fiche";
const PLAN_STEP_CODE = "plan";
const FICHE_ENTITY = "book_fiche";
const QR_RE = /^[A-Z0-9]{3,8}$/;

export type FicheJournalRow = { id: string; at: string; fields: string[] };

export type BookFiche = {
  id: string;
  titleFr: string;
  slug: string;
  qrCode: string;
  qrLocked: boolean;
  tomeNo: number | null;
  collectionId: string | null;
  collectionName: string | null;
  status: string;
  workSummaryFr: string;
  sourceMaterialFr: string;
  bookConstraintsFr: string;
  intentNoteFr: string;
  planValidated: boolean;
  ficheStepId: string | null;
  journal: FicheJournalRow[];
};

export type CollectionOption = { id: string; nameFr: string };

/** Les collections existantes : on choisit, on ne saisit jamais. */
export const atelierCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CollectionOption[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data } = await admin
      .from("collections")
      .select("id, name_fr, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return (data ?? []).map((c) => ({ id: c.id, nameFr: c.name_fr }));
  });

/** Slug dérivé du titre : sans accent, minuscules, tirets, puis -2, -3… si pris. */
function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length > 0 ? base : "livre";
}

async function uniqueSlug(
  admin: Awaited<ReturnType<typeof getAdminClient>>,
  title: string,
): Promise<string> {
  const base = slugify(title);
  for (let n = 1; n < 200; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const { data } = await admin.from("books").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Impossible de dériver un slug unique pour ce titre.");
}

/** Le code QR est unique sur toute la table ; le refus nomme le détenteur. */
async function assertQrLibre(
  admin: Awaited<ReturnType<typeof getAdminClient>>,
  qrCode: string,
  exceptBookId?: string,
): Promise<void> {
  const { data } = await admin
    .from("books")
    .select("id, title_fr")
    .eq("qr_code", qrCode)
    .maybeSingle();
  if (data && data.id !== exceptBookId) {
    throw new Error(`Le code ${qrCode} est déjà pris par « ${data.title_fr} ».`);
  }
}

const longText = z.string().trim().max(200000).optional();

export const createAtelierBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        titleFr: z.string().trim().min(1).max(300),
        collectionId: z.string().uuid(),
        tomeNo: z.number().int().min(1).max(999).nullable().optional(),
        qrCode: z
          .string()
          .trim()
          .transform((v) => v.toUpperCase())
          .refine((v) => QR_RE.test(v), "Le code QR : 3 à 8 lettres ou chiffres."),
        workSummaryFr: longText,
        sourceMaterialFr: longText,
        bookConstraintsFr: longText,
        intentNoteFr: longText,
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string; slug: string; steps: number }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    await assertQrLibre(admin, data.qrCode);
    const slug = await uniqueSlug(admin, data.titleFr);

    const { data: inserted, error } = await admin
      .from("books")
      .insert({
        title_fr: data.titleFr,
        collection_id: data.collectionId,
        tome_no: data.tomeNo ?? null,
        qr_code: data.qrCode,
        slug,
        // Naissance en fabrication : le site public ne lit que 'published'.
        status: "idea",
        work_summary_fr: data.workSummaryFr || null,
        source_material_fr: data.sourceMaterialFr || null,
        book_constraints_fr: data.bookConstraintsFr || null,
        intent_note_fr: data.intentNoteFr || null,
      })
      .select("id, slug")
      .single();
    if (error || !inserted) {
      if (error?.code === "23505") throw new Error(`Le code ${data.qrCode} est déjà pris.`);
      throw new Error("Création refusée.");
    }

    const { data: steps } = await admin.rpc("instancier_chaine", { p_book_id: inserted.id });

    await admin.from("content_versions").insert({
      entity: FICHE_ENTITY,
      entity_id: inserted.id,
      snapshot: {
        action: "creation",
        title_fr: data.titleFr,
        qr_code: data.qrCode,
        work_summary_fr: data.workSummaryFr ?? null,
        source_material_fr: data.sourceMaterialFr ?? null,
        book_constraints_fr: data.bookConstraintsFr ?? null,
        intent_note_fr: data.intentNoteFr ?? null,
      },
      created_by: editor.userId,
    });

    return { id: inserted.id, slug: inserted.slug, steps: (steps as number | null) ?? 0 };
  });

export const atelierBookFiche = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<BookFiche | null> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: book } = await admin
      .from("books")
      .select(
        "id, title_fr, slug, qr_code, qr_reserved_at, tome_no, collection_id, status, work_summary_fr, source_material_fr, book_constraints_fr, intent_note_fr",
      )
      .eq("id", data.bookId)
      .maybeSingle();
    if (!book) return null;

    const [collection, steps, journal] = await Promise.all([
      book.collection_id
        ? admin.from("collections").select("name_fr").eq("id", book.collection_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("book_steps")
        .select("id, step_code, status")
        .eq("book_id", book.id)
        .in("step_code", [FICHE_STEP_CODE, PLAN_STEP_CODE]),
      admin
        .from("content_versions")
        .select("id, snapshot, created_at")
        .eq("entity", FICHE_ENTITY)
        .eq("entity_id", book.id)
        .order("created_at", { ascending: false }),
    ]);

    const rows = steps.data ?? [];
    const plan = rows.find((s) => s.step_code === PLAN_STEP_CODE);
    const fiche = rows.find((s) => s.step_code === FICHE_STEP_CODE);

    return {
      id: book.id,
      titleFr: book.title_fr,
      slug: book.slug,
      qrCode: book.qr_code,
      qrLocked: Boolean(book.qr_reserved_at),
      tomeNo: book.tome_no ?? null,
      collectionId: book.collection_id ?? null,
      collectionName: (collection.data as { name_fr: string } | null)?.name_fr ?? null,
      status: book.status as string,
      workSummaryFr: book.work_summary_fr ?? "",
      sourceMaterialFr: book.source_material_fr ?? "",
      bookConstraintsFr: book.book_constraints_fr ?? "",
      intentNoteFr: book.intent_note_fr ?? "",
      planValidated: plan ? plan.status === "valide" || plan.status === "valide_hors_crm" : false,
      ficheStepId: fiche?.id ?? null,
      journal: (journal.data ?? []).map((row) => {
        const snap = (row.snapshot ?? {}) as Record<string, unknown>;
        const fields = Array.isArray(snap['fields'])
          ? (snap['fields'] as string[])
          : Object.keys(snap).filter((k) => k !== "action");
        return {
          id: row.id,
          at: row.created_at,
          fields: snap['action'] === "creation" ? ["creation"] : fields,
        };
      }),
    };
  });

export const updateAtelierBookFiche = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bookId: z.string().uuid(),
        qrCode: z
          .string()
          .trim()
          .transform((v) => v.toUpperCase())
          .refine((v) => QR_RE.test(v), "Le code QR : 3 à 8 lettres ou chiffres.")
          .optional(),
        workSummaryFr: longText,
        sourceMaterialFr: longText,
        bookConstraintsFr: longText,
        intentNoteFr: longText,
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; changed: string[] }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: book } = await admin
      .from("books")
      .select(
        "id, qr_code, qr_reserved_at, work_summary_fr, source_material_fr, book_constraints_fr, intent_note_fr",
      )
      .eq("id", data.bookId)
      .maybeSingle();
    if (!book) throw new Error("Livre introuvable.");

    const { data: plan } = await admin
      .from("book_steps")
      .select("status")
      .eq("book_id", book.id)
      .eq("step_code", PLAN_STEP_CODE)
      .maybeSingle();
    const planValidated = plan?.status === "valide" || plan?.status === "valide_hors_crm";

    type FichePatch = {
      work_summary_fr?: string | null;
      source_material_fr?: string | null;
      book_constraints_fr?: string | null;
      intent_note_fr?: string | null;
      qr_code?: string;
    };
    const patch: FichePatch = {};
    const changed: string[] = [];

    const matiere: [keyof FichePatch, string | undefined, string | null][] = [
      ["work_summary_fr", data.workSummaryFr, book.work_summary_fr],
      ["source_material_fr", data.sourceMaterialFr, book.source_material_fr],
      ["book_constraints_fr", data.bookConstraintsFr, book.book_constraints_fr],
      ["intent_note_fr", data.intentNoteFr, book.intent_note_fr],
    ];
    for (const [column, next, current] of matiere) {
      if (next === undefined) continue;
      const value = next.length > 0 ? next : null;
      if (value === (current ?? null)) continue;
      if (planValidated) {
        throw new Error("Le plan est validé : la matière du livre est gelée.");
      }
      (patch as Record<string, string | null>)[column] = value;
      changed.push(column);
    }

    if (data.qrCode !== undefined && data.qrCode !== book.qr_code) {
      if (book.qr_reserved_at) {
        throw new Error("Le code QR est réservé : il est définitif.");
      }
      await assertQrLibre(admin, data.qrCode, book.id);
      patch.qr_code = data.qrCode;
      changed.push("qr_code");
    }

    if (changed.length === 0) return { ok: true, changed: [] };

    const { error } = await admin.from("books").update(patch).eq("id", book.id);
    if (error) throw new Error("Enregistrement refusé.");

    await admin.from("content_versions").insert({
      entity: FICHE_ENTITY,
      entity_id: book.id,
      snapshot: { fields: changed, values: patch as Record<string, string | null> },
      created_by: editor.userId,
    });

    return { ok: true, changed };
  });
