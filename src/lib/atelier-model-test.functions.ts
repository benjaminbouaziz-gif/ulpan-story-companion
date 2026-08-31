import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./editor-context.server";
import { MODELES } from "./atelier-models";
import { appelerModele, cleConfiguree, secretDuModele } from "./robot-provider.server";

/**
 * TESTER LES MODÈLES.
 *
 * Un mini-appel à chacun des deux fournisseurs, et on affiche l'identifiant de
 * modèle RENVOYÉ PAR LA RÉPONSE — pas celui demandé. C'est la seule preuve de
 * qui a réellement répondu.
 */

export type TestModele = {
  demande: string;
  label: string;
  ok: boolean;
  modelUsed: string | null;
  durationMs: number;
  message: string | null;
};

export const testerModeles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TestModele[]> => {
    await assertEditor(context.supabase, context.userId);

    const resultats: TestModele[] = [];
    for (const m of MODELES) {
      const t0 = Date.now();
      if (!cleConfiguree(m.id)) {
        resultats.push({
          demande: m.id,
          label: m.label,
          ok: false,
          modelUsed: null,
          durationMs: 0,
          message: `Il manque la clé ${secretDuModele(m.id)} dans les secrets du projet.`,
        });
        continue;
      }
      try {
        const res = await appelerModele({
          model: m.id,
          webSearch: false,
          system: "Réponds par un seul mot.",
          user: "Dis « présent ».",
        });
        resultats.push({
          demande: m.id,
          label: m.label,
          ok: true,
          modelUsed: res.modelUsed,
          durationMs: Date.now() - t0,
          message: res.text.trim().slice(0, 120) || null,
        });
      } catch (e) {
        resultats.push({
          demande: m.id,
          label: m.label,
          ok: false,
          modelUsed: null,
          durationMs: Date.now() - t0,
          message: (e instanceof Error ? e.message : String(e)).slice(0, 400),
        });
      }
    }
    return resultats;
  });
