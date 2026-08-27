import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * LOT B — LA FRONTIÈRE DE SÉCURITÉ.
 *
 * RLS ne protège rien contre le client de service : il la contourne
 * intégralement. La vraie frontière est le contrôle du rôle. Elle ne doit pas
 * rester une discipline : elle devient une impossibilité de typage.
 *
 * `EditorContext` porte une marque privée (`unique symbol`) : aucun autre
 * fichier ne peut en fabriquer un. Comme `getAdminClient` en exige un, le
 * client de service devient inatteignable sans être passé par `assertEditor`.
 */
declare const marque: unique symbol;

export type EditorContext = {
  readonly userId: string;
  readonly [marque]: "EditorContext";
};

/** Le rôle vient toujours de la base, jamais du client. Seul fabricant d'un EditorContext. */
export async function assertEditor(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<EditorContext> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Forbidden");
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("editor")) throw new Error("Forbidden");
  return { userId } as EditorContext;
}
