import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import {
  avancerControlePlan,
  etatControlePlan,
  type EtatControlePlan,
} from "./plan-controle-run.server";

/**
 * LE CONTRÔLE DU PLAN, VU DE L'ÉCRAN. Deux fonctions, pas plus :
 *  - lire l'état du flux (aucun appel de modèle) ;
 *  - avancer d'UN maillon (au plus un appel de modèle).
 *
 * L'écran ne décide de rien : il exécute le maillon que l'état annonce.
 */

const stepId = z.object({ bookStepId: z.string().uuid() });

export const planControlState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookStepId: string }) => stepId.parse(data))
  .handler(async ({ data, context }): Promise<EtatControlePlan> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return etatControlePlan(editor, data.bookStepId);
  });

export const advancePlanControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bookStepId: string }) => stepId.parse(data))
  .handler(async ({ data, context }): Promise<{ message: string; etat: EtatControlePlan }> => {
    const editor = await assertEditor(context.supabase, context.userId);
    return avancerControlePlan(editor, data.bookStepId);
  });
