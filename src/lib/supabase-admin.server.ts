import type { EditorContext } from "./editor-context.server";

/**
 * SEULE porte d'entrée applicative vers le client de service (celui qui
 * contourne RLS). Elle exige un `EditorContext`, que seul `assertEditor` sait
 * fabriquer : impossible d'atteindre la base en écriture sans avoir lu le rôle.
 *
 * L'import est dynamique : les fichiers `*.functions.ts` entrent dans le
 * graphe client, la clé ne doit jamais y être tirée au chargement du module.
 */
export async function getAdminClient(_ctx: EditorContext) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
