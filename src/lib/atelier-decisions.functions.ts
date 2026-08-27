import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { questionKey } from "./decisions.server";

/**
 * BRIQUE 7 — LES PORTES DU REGISTRE DES DÉCISIONS.
 *
 * Toute lecture, toute écriture commence par assertEditor : le rôle est lu en
 * base, jamais annoncé par le client. Aucune décision n'est jamais supprimée
 * en silence : chaque modification laisse une ligne au journal de l'étape
 * (content_versions, entité « book_decision »), avec l'état d'AVANT.
 */

export type DecisionRow = {
  id: string;
  bookId: string;
  bookStepId: string | null;
  stepLabelFr: string | null;
  sortOrder: number;
  question: string;
  contexte: string | null;
  decision: string | null;
  status: "ouverte" | "tranchee" | "ecartee";
  stale: boolean;
  createdAt: string;
  decidedAt: string | null;
};

type Brut = {
  id: string;
  book_id: string;
  book_step_id: string | null;
  sort_order: number;
  question: string;
  contexte: string | null;
  decision: string | null;
  status: string;
  stale: boolean;
  created_at: string;
  decided_at: string | null;
};

function mapRow(r: Brut, labels: Map<string, string>): DecisionRow {
  return {
    id: r.id,
    bookId: r.book_id,
    bookStepId: r.book_step_id,
    stepLabelFr: r.book_step_id ? (labels.get(r.book_step_id) ?? null) : null,
    sortOrder: r.sort_order,
    question: r.question,
    contexte: r.contexte,
    decision: r.decision,
    status: (r.status as DecisionRow["status"]) ?? "ouverte",
    stale: r.stale,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
  };
}

const SELECT =
  "id, book_id, book_step_id, sort_order, question, contexte, decision, status, stale, created_at, decided_at";

/** Les décisions d'une étape, plus l'état de la dernière lecture automatique. */
export const stepDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(
    async ({
      context,
      data,
    }): Promise<{ decisions: DecisionRow[]; parseFailed: boolean; bookId: string | null }> => {
      const editor = await assertEditor(context.supabase, context.userId);
      const admin = await getAdminClient(editor);

      const { data: step } = await admin
        .from("book_steps")
        .select("id, book_id, label_fr")
        .eq("id", data.bookStepId)
        .maybeSingle();
      if (!step) return { decisions: [], parseFailed: false, bookId: null };

      const [{ data: rows }, { data: marqueurs }] = await Promise.all([
        admin
          .from("book_decisions")
          .select(SELECT)
          .eq("book_step_id", step.id)
          .order("stale", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        admin
          .from("content_versions")
          .select("snapshot")
          .eq("entity", "book_decisions_parse")
          .eq("entity_id", step.id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const dernier = (marqueurs?.[0]?.snapshot ?? null) as { ok?: boolean } | null;
      const labels = new Map([[step.id, step.label_fr]]);

      return {
        decisions: (rows ?? []).map((r) => mapRow(r as Brut, labels)),
        parseFailed: dernier ? dernier.ok === false : false,
        bookId: step.book_id,
      };
    },
  );

/** Toutes les décisions d'un livre, toutes étapes confondues : la mémoire. */
export const bookDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<DecisionRow[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const [{ data: rows }, { data: steps }] = await Promise.all([
      admin
        .from("book_decisions")
        .select(SELECT)
        .eq("book_id", data.bookId)
        .order("stale", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      admin.from("book_steps").select("id, label_fr").eq("book_id", data.bookId),
    ]);
    const labels = new Map((steps ?? []).map((s) => [s.id, s.label_fr]));
    return (rows ?? []).map((r) => mapRow(r as Brut, labels));
  });

/** Une question saisie à la main. Sans limite de nombre. */
export const addDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bookStepId: z.string().uuid(),
        question: z.string().trim().min(1, "Il manque la question."),
        contexte: z.string().trim().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: step } = await admin
      .from("book_steps")
      .select("id, book_id")
      .eq("id", data.bookStepId)
      .maybeSingle();
    if (!step) throw new Error("Étape introuvable.");

    const { data: dernieres } = await admin
      .from("book_decisions")
      .select("sort_order")
      .eq("book_step_id", step.id)
      .order("sort_order", { ascending: false })
      .limit(1);

    const { data: inserted, error } = await admin
      .from("book_decisions")
      .insert({
        book_id: step.book_id,
        book_step_id: step.id,
        question: data.question,
        contexte: data.contexte?.trim() ? data.contexte.trim() : null,
        question_key: questionKey(data.question),
        status: "ouverte",
        sort_order: (dernieres?.[0]?.sort_order ?? 0) + 1,
        created_by: editor.userId,
      })
      .select("id")
      .single();
    if (error || !inserted)
      throw new Error("Cette question existe déjà sur cette étape, ou son ajout a été refusé.");

    await admin.from("content_versions").insert({
      entity: "book_decision",
      entity_id: inserted.id,
      snapshot: { action: "creation", question: data.question, bookStepId: step.id },
      created_by: editor.userId,
    });
    return { id: inserted.id };
  });

/**
 * MODIFIER UNE DÉCISION. Je peux changer d'avis : l'état d'AVANT est écrit au
 * journal, pour que je retrouve quand j'ai changé d'avis et ce que j'avais mis.
 */
export const saveDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        question: z.string().trim().min(1, "Il manque la question."),
        contexte: z.string().trim().optional(),
        decision: z.string().trim().optional(),
        status: z.enum(["ouverte", "tranchee", "ecartee"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ status: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: avant } = await admin
      .from("book_decisions")
      .select("id, book_step_id, question, contexte, decision, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!avant) throw new Error("Décision introuvable.");

    if (data.status === "tranchee" && !(data.decision ?? "").trim())
      throw new Error("Une question tranchée exige une décision écrite.");

    const now = new Date().toISOString();
    const { error } = await admin
      .from("book_decisions")
      .update({
        question: data.question,
        question_key: questionKey(data.question),
        contexte: data.contexte?.trim() ? data.contexte.trim() : null,
        decision: data.decision?.trim() ? data.decision.trim() : null,
        status: data.status,
        decided_at: data.status === "ouverte" ? null : now,
      })
      .eq("id", data.id);
    if (error) throw new Error(texteErreurBase("Modification refusée", error));

    await admin.from("content_versions").insert({
      entity: "book_decision",
      entity_id: data.id,
      snapshot: {
        action: "modification",
        bookStepId: avant.book_step_id,
        avant: {
          question: avant.question,
          contexte: avant.contexte,
          decision: avant.decision,
          status: avant.status,
        },
      },
      created_by: editor.userId,
    });
    return { status: data.status };
  });

/** Supprimer une ligne que j'ai jugée sans objet. Le journal la garde. */
export const deleteDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ deleted: boolean }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: avant } = await admin
      .from("book_decisions")
      .select("id, book_step_id, question, contexte, decision, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!avant) throw new Error("Décision introuvable.");

    await admin.from("content_versions").insert({
      entity: "book_decision",
      entity_id: data.id,
      snapshot: {
        action: "suppression",
        bookStepId: avant.book_step_id,
        avant: {
          question: avant.question,
          contexte: avant.contexte,
          decision: avant.decision,
          status: avant.status,
        },
      },
      created_by: editor.userId,
    });
    const { error } = await admin.from("book_decisions").delete().eq("id", data.id);
    if (error) throw new Error(texteErreurBase("Suppression refusée", error));
    return { deleted: true };
  });
