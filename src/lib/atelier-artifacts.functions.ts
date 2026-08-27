import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { ARTIFACT_TYPES, artifactPath } from "./artifact-path";
import { balayerOrphelins, sha256Hex, signArtifact, uploadArtifactBytes } from "./atelier-artifacts.server";

/**
 * Les portes de validation : déposer un artefact, l'ouvrir par une URL signée,
 * rendre un avis. Chaque appel relit le rôle en base (assertEditor) avant de
 * toucher quoi que ce soit.
 */

export type ArtifactRow = {
  id: string;
  type: string;
  version: number;
  storagePath: string;
  sizeBytes: number | null;
  checksum: string | null;
  origin: string;
  createdAt: string;
};

export type ReviewRow = {
  id: string;
  decision: string;
  comment: string | null;
  createdAt: string;
  artifactId: string | null;
};

/** La ligne de situation qui ouvre le dossier : rien d'inventé, tout est lu. */
export type StepSituation = {
  stepId: string;
  stepCode: string;
  bookId: string;
  bookTitle: string;
  rank: number;
  labelFr: string;
  status: string;
  awaiting: string | null;
  species: string;
  note: string | null;
};

export const stepDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{
    situation: StepSituation | null;
    artifacts: ArtifactRow[];
    reviews: ReviewRow[];
    ficheChanges: { id: string; at: string; fields: string[] }[];
    decisionChanges: { id: string; at: string; action: string; before: string | null }[];
  }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const [arts, revs, step] = await Promise.all([
      admin
        .from("artifacts")
        .select("id, type, version, storage_path, size_bytes, checksum, origin, created_at")
        .eq("book_step_id", data.bookStepId)
        .order("created_at", { ascending: false }),
      admin
        .from("reviews")
        .select("id, decision, comment, created_at, artifact_id")
        .eq("book_step_id", data.bookStepId)
        .order("created_at", { ascending: false }),
      admin
        .from("book_steps")
        .select("id, book_id, step_code, rank, label_fr, status, awaiting, species, note")
        .eq("id", data.bookStepId)
        .maybeSingle(),
    ]);

    /**
     * Le journal de l'étape « Fiche du livre » compte les modifications de la
     * fiche comme des dépôts : elles sont lues dans content_versions.
     */
    let ficheChanges: { id: string; at: string; fields: string[] }[] = [];
    if (step.data?.step_code === "fiche") {
      const { data: rows } = await admin
        .from("content_versions")
        .select("id, snapshot, created_at")
        .eq("entity", "book_fiche")
        .eq("entity_id", step.data.book_id)
        .order("created_at", { ascending: false });
      ficheChanges = (rows ?? []).map((r) => {
        const snap = (r.snapshot ?? {}) as Record<string, unknown>;
        const fields = Array.isArray(snap['fields'])
          ? (snap['fields'] as string[])
          : Object.keys(snap).filter((k) => k !== "action");
        return {
          id: r.id,
          at: r.created_at,
          fields: snap['action'] === "creation" ? ["creation"] : fields,
        };
      });
    }

    /**
     * BRIQUE 7 — le journal de l'étape porte aussi mes changements d'avis :
     * chaque modification d'une décision a écrit son état d'AVANT.
     */
    const { data: decRows } = await admin
      .from("content_versions")
      .select("id, snapshot, created_at")
      .eq("entity", "book_decision")
      .eq("snapshot->>bookStepId", data.bookStepId)
      .order("created_at", { ascending: false });
    const decisionChanges = (decRows ?? []).map((r) => {
      const snap = (r.snapshot ?? {}) as {
        action?: string;
        question?: string;
        avant?: { question?: string; decision?: string | null; status?: string };
      };
      const avant = snap.avant;
      const before = avant
        ? [avant.question, avant.status, avant.decision].filter(Boolean).join(" · ")
        : (snap.question ?? null);
      return {
        id: r.id,
        at: r.created_at,
        action: snap.action ?? "modification",
        before: before || null,
      };
    });

    let situation: StepSituation | null = null;
    if (step.data) {
      const { data: book } = await admin
        .from("books")
        .select("title_fr")
        .eq("id", step.data.book_id)
        .maybeSingle();
      situation = {
        stepId: step.data.id,
        stepCode: step.data.step_code,
        bookId: step.data.book_id,
        bookTitle: book?.title_fr ?? "",
        rank: step.data.rank,
        labelFr: step.data.label_fr,
        status: step.data.status,
        awaiting: step.data.awaiting ?? null,
        species: step.data.species,
        note: step.data.note ?? null,
      };
    }

    return {
      situation,
      ficheChanges,
      decisionChanges,
      artifacts: (arts.data ?? []).map((a) => ({
        id: a.id,
        type: a.type,
        version: a.version,
        storagePath: a.storage_path,
        sizeBytes: a.size_bytes ?? null,
        checksum: a.checksum ?? null,
        origin: a.origin,
        createdAt: a.created_at,
      })),
      reviews: (revs.data ?? []).map((r) => ({
        id: r.id,
        decision: r.decision,
        comment: r.comment ?? null,
        createdAt: r.created_at,
        artifactId: r.artifact_id ?? null,
      })),
    };
  });

/** URL signée, 15 minutes, fabriquée à la demande, jamais persistée. */
export const artifactSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ artifactId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data: row } = await admin
      .from("artifacts")
      .select("storage_path")
      .eq("id", data.artifactId)
      .maybeSingle();
    if (!row) throw new Error("Artefact introuvable");
    return { url: await signArtifact(editor, row.storage_path) };
  });

/**
 * Dépôt d'un artefact. Téléversement d'abord, insertion ensuite : la ligne
 * n'existe que si les octets existent. Le dépôt place l'étape en attente de
 * validation (elle n'avance jamais toute seule).
 */
export const uploadArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: FormData) => {
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Fichier manquant");
    return {
      bookStepId: z.string().uuid().parse(data.get("bookStepId")),
      type: z.enum(ARTIFACT_TYPES).parse(data.get("type")),
      file,
    };
  })
  .handler(async ({ context, data }): Promise<{ id: string; version: number }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: step } = await admin
      .from("book_steps")
      .select("id, book_id, step_code, lang, status, species")
      .eq("id", data.bookStepId)
      .maybeSingle();
    if (!step) throw new Error("Étape introuvable");

    const { data: last } = await admin
      .from("artifacts")
      .select("version")
      .eq("book_step_id", step.id)
      .eq("type", data.type)
      .order("version", { ascending: false })
      .limit(1);
    const version = (last?.[0]?.version ?? 0) + 1;

    const storagePath = artifactPath({
      bookId: step.book_id,
      stepCode: step.step_code,
      lang: step.lang,
      type: data.type,
      version,
      fileName: data.file.name,
    });

    const bytes = await data.file.arrayBuffer();
    // 1) les octets
    await uploadArtifactBytes(editor, storagePath, bytes, data.file.type || "application/octet-stream");
    // 2) la ligne, calculée sur ces mêmes octets
    const checksum = await sha256Hex(bytes);
    const { data: inserted, error } = await admin
      .from("artifacts")
      .insert({
        book_step_id: step.id,
        type: data.type,
        version,
        storage_path: storagePath,
        checksum,
        size_bytes: bytes.byteLength,
        origin: "ben",
        created_by: editor.userId,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error("Dépôt refusé");

    if (step.status !== "valide" && step.status !== "valide_hors_crm") {
      await admin
        .from("book_steps")
        .update({ status: "attend_validation", awaiting: "ben", updated_at: new Date().toISOString() })
        .eq("id", step.id);
    }

    return { id: inserted.id, version };
  });

/** Avis rendu : la décision commande le statut de l'étape, jamais l'inverse. */
export const reviewStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bookStepId: z.string().uuid(),
        artifactId: z.string().uuid().optional(),
        decision: z.enum(["valide", "revision_demandee"]),
        comment: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ status: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: step } = await admin
      .from("book_steps")
      .select("id, species")
      .eq("id", data.bookStepId)
      .maybeSingle();
    if (!step) throw new Error("Étape introuvable");

    if (data.decision === "revision_demandee" && !data.comment) {
      throw new Error("Une révision demandée exige un motif écrit.");
    }

    await admin.from("reviews").insert({
      book_step_id: step.id,
      artifact_id: data.artifactId ?? null,
      decision: data.decision,
      comment: data.comment ?? null,
      author: editor.userId,
    });

    const now = new Date().toISOString();
    const patch =
      data.decision === "valide"
        ? { status: "valide", awaiting: null, closed_at: now, updated_at: now }
        : {
            status: "en_revision",
            awaiting: step.species === "humaine" ? "ben" : "robot",
            closed_at: null,
            updated_at: now,
          };
    await admin.from("book_steps").update(patch).eq("id", step.id);
    return { status: patch.status };
  });

/** Balayage manuel des objets orphelins (téléversés sans ligne, > 24 h). */
export const sweepArtifactOrphans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const editor = await assertEditor(context.supabase, context.userId);
    return balayerOrphelins(editor);
  });
