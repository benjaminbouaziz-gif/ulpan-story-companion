import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";

/**
 * BRIQUE 3 — LA FILE D'ATTENTE.
 *
 * Une file unique, tous livres confondus : la prochaine chose à faire, pas un
 * panorama. Tout est lu en base au moment de l'appel ; aucun chiffre n'est
 * conservé, aucun compteur n'est décoratif.
 *
 * ORDRE DE LA FILE : les étapes en `attend_validation` dont l'attente est
 * 'ben', triées par `awaiting_since` croissant — celle qui attend depuis le plus
 * longtemps d'abord. `awaiting_since` est écrite par déclencheur au seul moment
 * de l'entrée en attente ; aucun dépôt, aucune note, aucun robot ne la rajeunit.
 *
 * AXE LANGUE EN SOMMEIL : seules les étapes 'shared' et 'fr' sont lues, et
 * aucune langue n'est affichée.
 */

const LANGS_VISIBLES = ["shared", "fr"];

export type QueueArtifact = { type: string; version: number };

export type QueueStep = {
  stepId: string;
  bookId: string;
  bookTitle: string;
  rank: number;
  labelFr: string;
  status: string;
  awaiting: string | null;
  since: string | null;
  note: string | null;
  robotName: string | null;
  errorSummary: string | null;
  lastArtifact: QueueArtifact | null;
};

export type QueueMove = {
  id: string;
  at: string;
  kind: "decision" | "depot";
  label: string;
  bookTitle: string;
  stepId: string;
  stepLabelFr: string;
  comment: string | null;
};

export type AtelierQueue = {
  signature: QueueStep[];
  running: QueueStep[];
  revision: QueueStep[];
  failed: QueueStep[];
  moves: QueueMove[];
};

export const atelierQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AtelierQueue> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: steps } = await admin
      .from("book_steps")
      .select("id, book_id, rank, step_code, label_fr, status, awaiting, note, awaiting_since")
      .in("lang", LANGS_VISIBLES)
      .in("status", ["attend_validation", "en_cours", "en_revision", "echoue"])
      .order("awaiting_since", { ascending: true, nullsFirst: false });

    const rows = steps ?? [];
    const stepIds = rows.map((s) => s.id);
    const bookIds = Array.from(new Set(rows.map((s) => s.book_id)));

    const [books, arts, runs] = await Promise.all([
      bookIds.length > 0
        ? admin.from("books").select("id, title_fr").in("id", bookIds)
        : Promise.resolve({ data: [] as { id: string; title_fr: string }[] }),
      stepIds.length > 0
        ? admin
            .from("artifacts")
            .select("id, book_step_id, type, version, created_at")
            .in("book_step_id", stepIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as { id: string; book_step_id: string; type: string; version: number; created_at: string }[] }),
      stepIds.length > 0
        ? admin
            .from("agent_runs")
            .select("book_step_id, robot_name, error_summary, created_at")
            .in("book_step_id", stepIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as { book_step_id: string | null; robot_name: string | null; error_summary: string | null; created_at: string }[] }),
    ]);

    const titles = new Map((books.data ?? []).map((b) => [b.id, b.title_fr]));
    const lastArtifact = new Map<string, QueueArtifact>();
    for (const a of arts.data ?? []) {
      if (!lastArtifact.has(a.book_step_id)) lastArtifact.set(a.book_step_id, { type: a.type, version: a.version });
    }
    const lastRun = new Map<string, { robot: string | null; error: string | null }>();
    for (const r of runs.data ?? []) {
      if (r.book_step_id && !lastRun.has(r.book_step_id))
        lastRun.set(r.book_step_id, { robot: r.robot_name ?? null, error: r.error_summary ?? null });
    }

    const map = (s: (typeof rows)[number]): QueueStep => ({
      stepId: s.id,
      bookId: s.book_id,
      bookTitle: titles.get(s.book_id) ?? "",
      rank: s.rank,
      labelFr: s.label_fr,
      status: s.status,
      awaiting: s.awaiting ?? null,
      since: s.awaiting_since ?? null,
      note: s.note ?? null,
      robotName: lastRun.get(s.id)?.robot ?? null,
      errorSummary: lastRun.get(s.id)?.error ?? null,
      lastArtifact: lastArtifact.get(s.id) ?? null,
    });

    const all = rows.map(map);

    // « Ce qui a bougé » : dépôts et décisions mêlés, dix plus récents.
    const [recentArts, recentRevs] = await Promise.all([
      admin
        .from("artifacts")
        .select("id, book_step_id, type, version, origin, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("reviews")
        .select("id, book_step_id, decision, comment, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const moveStepIds = Array.from(
      new Set([
        ...(recentArts.data ?? []).map((a) => a.book_step_id),
        ...(recentRevs.data ?? []).map((r) => r.book_step_id),
      ]),
    );
    const { data: moveSteps } = moveStepIds.length
      ? await admin.from("book_steps").select("id, book_id, label_fr").in("id", moveStepIds)
      : { data: [] as { id: string; book_id: string; label_fr: string }[] };
    const moveBookIds = Array.from(new Set((moveSteps ?? []).map((s) => s.book_id)));
    const { data: moveBooks } = moveBookIds.length
      ? await admin.from("books").select("id, title_fr").in("id", moveBookIds)
      : { data: [] as { id: string; title_fr: string }[] };
    const moveTitles = new Map((moveBooks ?? []).map((b) => [b.id, b.title_fr]));
    const stepInfo = new Map((moveSteps ?? []).map((s) => [s.id, s]));

    const moves: QueueMove[] = [
      ...(recentArts.data ?? []).map((a) => ({
        id: `a-${a.id}`,
        at: a.created_at,
        kind: "depot" as const,
        label: `${a.type} v${a.version} (${a.origin})`,
        bookTitle: moveTitles.get(stepInfo.get(a.book_step_id)?.book_id ?? "") ?? "",
        stepId: a.book_step_id,
        stepLabelFr: stepInfo.get(a.book_step_id)?.label_fr ?? "",
        comment: null,
      })),
      ...(recentRevs.data ?? []).map((r) => ({
        id: `r-${r.id}`,
        at: r.created_at,
        kind: "decision" as const,
        label: r.decision,
        bookTitle: moveTitles.get(stepInfo.get(r.book_step_id)?.book_id ?? "") ?? "",
        stepId: r.book_step_id,
        stepLabelFr: stepInfo.get(r.book_step_id)?.label_fr ?? "",
        comment: r.comment ?? null,
      })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 10);

    return {
      signature: all.filter((s) => s.status === "attend_validation" && s.awaiting === "ben"),
      running: all.filter((s) => s.status === "en_cours"),
      revision: all.filter((s) => s.status === "en_revision"),
      failed: all.filter((s) => s.status === "echoue"),
      moves,
    };
  });
