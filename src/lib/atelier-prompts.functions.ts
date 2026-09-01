import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { getAdminClient } from "./supabase-admin.server";
import { texteErreurBase } from "./db-error";

/**
 * BRIQUE 4 — LA BIBLIOTHÈQUE DE PROMPTS.
 *
 * LA RÈGLE : un prompt ne se modifie jamais, il se RE-PUBLIE. Enregistrer un
 * contenu crée une nouvelle version ; l'ancienne demeure et reste attachée aux
 * artefacts qu'elle a produits (artifacts.prompt_version_id). L'écriture
 * unique n'est pas une discipline applicative : deux déclencheurs sur
 * prompt_versions refusent toute modification et toute suppression, et
 * journalisent l'échappatoire de maintenance.
 *
 * Seules les étapes d'espèce 'llm' ont un prompt : les étapes déterministes
 * sont des fonctions avec leurs contrôles, les étapes humaines n'en ont pas.
 *
 * Chaque fonction relit le rôle en base (assertEditor) avant tout accès.
 */

export type PromptStepOption = { code: string; labelFr: string; rank: number };

export type PromptListRow = {
  id: string;
  stepCode: string;
  stepLabelFr: string;
  rank: number;
  name: string;
  activeVersion: number | null;
  activeModel: string | null;
  activeWebSearch: boolean;
  lastVersionAt: string | null;
  versionsCount: number;
};

export type PromptVersionRow = {
  id: string;
  version: number;
  content: string;
  changeNote: string | null;
  model: string | null;
  webSearch: boolean;
  createdAt: string;
  isActive: boolean;
};

export type PromptProducedRow = {
  versionId: string;
  bookTitle: string;
  stepLabelFr: string;
  type: string;
  version: number;
  createdAt: string;
};

export type PromptActivationRow = {
  id: string;
  version: number;
  createdAt: string;
};

/** Les étapes qui peuvent porter un prompt : espèce 'llm' seulement. */
export const atelierPromptSteps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PromptStepOption[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);
    const { data } = await admin
      .from("step_templates")
      .select("code, label_fr, rank, species, is_active")
      .eq("species", "llm")
      .eq("is_active", true)
      .order("rank", { ascending: true });
    return (data ?? []).map((s) => ({ code: s.code, labelFr: s.label_fr, rank: s.rank }));
  });

/** La liste, rangée dans l'ordre de la chaîne (rank), jamais alphabétique. */
export const atelierPrompts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PromptListRow[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const [{ data: prompts }, { data: templates }, { data: versions }] = await Promise.all([
      admin.from("prompts").select("id, step_code, name, active_version_id"),
      admin.from("step_templates").select("code, label_fr, rank"),
      admin.from("prompt_versions").select("id, prompt_id, version, created_at, model, web_search"),
    ]);

    const tpl = new Map((templates ?? []).map((t) => [t.code, t]));
    const rows: PromptListRow[] = (prompts ?? []).map((p) => {
      const mine = (versions ?? []).filter((v) => v.prompt_id === p.id);
      const last = mine.reduce<{ version: number; created_at: string } | null>(
        (acc, v) => (acc === null || v.version > acc.version ? v : acc),
        null,
      );
      const active = mine.find((v) => v.id === p.active_version_id);
      return {
        id: p.id,
        stepCode: p.step_code,
        stepLabelFr: tpl.get(p.step_code)?.label_fr ?? p.step_code,
        rank: tpl.get(p.step_code)?.rank ?? 999,
        name: p.name,
        activeVersion: active?.version ?? null,
        activeModel: active?.model ?? null,
        activeWebSearch: active?.web_search ?? false,
        lastVersionAt: last?.created_at ?? null,
        versionsCount: mine.length,
      };
    });
    rows.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "fr"));
    return rows;
  });

/** Le dossier d'un prompt : version active, historique, activations, production. */
export const promptDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ promptId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{
    prompt: { id: string; name: string; stepCode: string; stepLabelFr: string; activeVersionId: string | null } | null;
    versions: PromptVersionRow[];
    activations: PromptActivationRow[];
    produced: PromptProducedRow[];
  }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: prompt } = await admin
      .from("prompts")
      .select("id, name, step_code, active_version_id")
      .eq("id", data.promptId)
      .maybeSingle();
    if (!prompt) return { prompt: null, versions: [], activations: [], produced: [] };

    const [{ data: tpl }, { data: versions }, { data: activations }] = await Promise.all([
      admin.from("step_templates").select("label_fr").eq("code", prompt.step_code).maybeSingle(),
      admin
        .from("prompt_versions")
        .select("id, version, content, change_note, model, web_search, created_at")
        .eq("prompt_id", prompt.id)
        .order("version", { ascending: false }),
      admin
        .from("prompt_activations")
        .select("id, version, created_at")
        .eq("prompt_id", prompt.id)
        .order("created_at", { ascending: false }),
    ]);

    const versionIds = (versions ?? []).map((v) => v.id);
    let produced: PromptProducedRow[] = [];
    if (versionIds.length > 0) {
      const { data: arts } = await admin
        .from("artifacts")
        .select("prompt_version_id, type, version, created_at, book_step_id")
        .in("prompt_version_id", versionIds)
        .order("created_at", { ascending: false });
      const stepIds = [...new Set((arts ?? []).map((a) => a.book_step_id))];
      const steps = stepIds.length
        ? (await admin.from("book_steps").select("id, label_fr, book_id").in("id", stepIds)).data ?? []
        : [];
      const bookIds = [...new Set(steps.map((s) => s.book_id))];
      const books = bookIds.length
        ? (await admin.from("books").select("id, title_fr").in("id", bookIds)).data ?? []
        : [];
      produced = (arts ?? []).map((a) => {
        const step = steps.find((s) => s.id === a.book_step_id);
        const book = books.find((b) => b.id === step?.book_id);
        return {
          versionId: a.prompt_version_id as string,
          bookTitle: book?.title_fr ?? "",
          stepLabelFr: step?.label_fr ?? "",
          type: a.type,
          version: a.version,
          createdAt: a.created_at,
        };
      });
    }

    return {
      prompt: {
        id: prompt.id,
        name: prompt.name,
        stepCode: prompt.step_code,
        stepLabelFr: tpl?.label_fr ?? prompt.step_code,
        activeVersionId: prompt.active_version_id ?? null,
      },
      versions: (versions ?? []).map((v) => ({
        id: v.id,
        version: v.version,
        content: v.content,
        changeNote: v.change_note ?? null,
        model: v.model ?? null,
        webSearch: v.web_search ?? false,
        createdAt: v.created_at,
        isActive: v.id === prompt.active_version_id,
      })),
      activations: (activations ?? []).map((a) => ({ id: a.id, version: a.version, createdAt: a.created_at })),
      produced,
    };
  });

/** Création : le prompt et sa version 1, active d'emblée. */
export const createPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        stepCode: z.string().min(1),
        name: z.string().trim().min(1),
        collectionId: z.string().uuid().nullable().optional(),
        content: z.string().trim().min(1),
        model: z.string().trim().min(1).nullable().optional(),
        webSearch: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ promptId: string }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    // L'étape ne vient jamais de la saisie : elle doit être une étape 'llm'.
    const { data: tpl } = await admin
      .from("step_templates")
      .select("code, species")
      .eq("code", data.stepCode)
      .maybeSingle();
    if (!tpl || tpl.species !== "llm") throw new Error("L’étape choisie ne peut pas recevoir de prompt.");

    // Code unique, dérivé de l'étape.
    const { data: siblings } = await admin.from("prompts").select("code").like("code", `${tpl.code}%`);
    let code = tpl.code;
    let n = 1;
    const taken = new Set((siblings ?? []).map((s) => s.code));
    while (taken.has(code)) {
      n += 1;
      code = `${tpl.code}-${n}`;
    }

    const { data: prompt, error } = await admin
      .from("prompts")
      .insert({
        code,
        name: data.name,
        step_code: tpl.code,
        // L'étape et le rôle sont obligatoires en base : ils découlent de l'étape
        // choisie, jamais de la saisie. Le rôle reprend le code, unique par nature.
        etape: tpl.code,
        role_code: code,
        collection_id: data.collectionId ?? null,
        is_active: true,
      })
      .select("id")
      .single();
    if (error || !prompt) {
      // La base n'admet qu'un seul prompt actif par étape (hors collection).
      if (error?.code === "23505" && (error.message ?? "").includes("prompts_actif_global")) {
        throw new Error(
          "Un prompt actif existe déjà pour cette étape. Ouvre-le et publie une nouvelle version plutôt que d'en créer un second.",
        );
      }
      throw new Error("L’enregistrement du prompt a été refusé par le serveur.");
    }

    const { data: version, error: vErr } = await admin
      .from("prompt_versions")
      .insert({
        prompt_id: prompt.id,
        version: 1,
        content: data.content,
        model: data.model ?? null,
        web_search: data.webSearch ?? false,
        created_by: editor.userId,
      })
      .select("id")
      .single();
    if (vErr || !version)
      throw new Error(texteErreurBase("La première version du prompt n’a pas pu être enregistrée", vErr));

    const { error: activeError } = await admin.from("prompts").update({ active_version_id: version.id }).eq("id", prompt.id);
    if (activeError) throw new Error("Le prompt a été créé, mais sa version n’a pas pu être activée.");
    const { error: activationError } = await admin.from("prompt_activations").insert({
      prompt_id: prompt.id,
      prompt_version_id: version.id,
      version: 1,
      reason: "création",
      created_by: editor.userId,
    });
    if (activationError)
      throw new Error(
        texteErreurBase("Le prompt a été créé, mais son activation n’a pas pu être enregistrée", activationError),
      );

    return { promptId: prompt.id };
  });

/** Nouvelle version : note de changement obligatoire, elle devient active. */
export const publishPromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        promptId: z.string().uuid(),
        content: z.string().trim().min(1),
        changeNote: z.string().trim().min(1),
        model: z.string().trim().min(1).nullable().optional(),
        webSearch: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ version: number }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: last } = await admin
      .from("prompt_versions")
      .select("version")
      .eq("prompt_id", data.promptId)
      .order("version", { ascending: false })
      .limit(1);
    const version = (last?.[0]?.version ?? 0) + 1;

    const { data: inserted, error } = await admin
      .from("prompt_versions")
      .insert({
        prompt_id: data.promptId,
        version,
        content: data.content,
        change_note: data.changeNote,
        model: data.model ?? null,
        web_search: data.webSearch ?? false,
        created_by: editor.userId,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error("La nouvelle version a été refusée par le serveur.");

    const { error: activeError } = await admin
      .from("prompts")
      .update({ active_version_id: inserted.id })
      .eq("id", data.promptId);
    if (activeError) throw new Error("La version a été créée, mais elle n’a pas pu être activée.");
    const { error: activationError } = await admin.from("prompt_activations").insert({
      prompt_id: data.promptId,
      prompt_version_id: inserted.id,
      version,
      reason: "publication",
      created_by: editor.userId,
    });
    if (activationError)
      throw new Error(
        texteErreurBase("La version a été créée, mais son activation n’a pas pu être enregistrée", activationError),
      );

    return { version };
  });

/** Changer la version active : action tracée à part, jamais un effet de bord. */
export const activatePromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ promptId: z.string().uuid(), versionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ version: number }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    const admin = await getAdminClient(editor);

    const { data: version } = await admin
      .from("prompt_versions")
      .select("id, version, prompt_id")
      .eq("id", data.versionId)
      .maybeSingle();
    if (!version || version.prompt_id !== data.promptId) throw new Error("Version introuvable");

    await admin.from("prompts").update({ active_version_id: version.id }).eq("id", data.promptId);
    await admin.from("prompt_activations").insert({
      prompt_id: data.promptId,
      prompt_version_id: version.id,
      version: version.version,
      reason: "remise en service",
      created_by: editor.userId,
    });

    return { version: version.version };
  });
