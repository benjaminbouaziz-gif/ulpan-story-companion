import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Le rôle vient toujours de la base, jamais du client. */
export async function assertEditor(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Forbidden");
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("editor")) throw new Error("Forbidden");
}
