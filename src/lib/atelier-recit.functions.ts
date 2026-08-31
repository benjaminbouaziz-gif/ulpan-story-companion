import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import {
  assemblerLeRecit,
  ecrireChapitresRestants,
  etatRecit,
  executerChapitre,
  reecrireTousLesChapitres,
  type ContexteRecit,
  type MaillonChapitre,
  type ResultatChapitre,
} from "./atelier-recit-run.server";

/**
 * BRIQUE 8 — les fonctions serveur du robot de rédaction. Elles ne font que
 * passer le relais : tout le travail vit dans atelier-recit-run.server, pour
 * rester appelable ailleurs (enchaînement, reprise) sans duplication.
 * L'arrêt d'un lancement reste `cancelPlanRun` : il vaut pour toute étape.
 */

export const recitState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<ContexteRecit | null> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return etatRecit(editor, data.bookStepId);
  });

export const writeChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bookStepId: z.string().uuid(),
        chapterNo: z.number().int().min(1).max(99).optional(),
        reason: z.string().trim().min(1).max(4000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<ResultatChapitre> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return executerChapitre(editor, data);
  });

export const writeRemainingChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<MaillonChapitre[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return ecrireChapitresRestants(editor, data.bookStepId);
  });

export const assembleRecit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bookStepId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ version: number; pages: number }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return assemblerLeRecit(editor, data.bookStepId);
  });

export const rewriteAllChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bookStepId: z.string().uuid(),
        reason: z.string().trim().min(1).max(4000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<MaillonChapitre[]> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return reecrireTousLesChapitres(editor, data.bookStepId, data.reason);
  });
