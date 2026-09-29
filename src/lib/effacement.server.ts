import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Effacement d'un lecteur, avec le client que l'appelant a le droit d'avoir
 * (porte lecteur : public-writes.server.ts ; porte éditeur : getAdminClient).
 * Utilisateur auth supprimé (cascade : readers, edition_access, quiz_answers,
 * reader_progress) + demandes et liste d'attente par adresse.
 * Refusé pour un compte admin ou editor.
 */
export async function effacerLecteur(admin: SupabaseClient<Database>, userId: string): Promise<"ok" | "staff"> {
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "editor"]);
  if (roles?.length) return "staff";
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const { data: r } = await admin.from("readers").select("email").eq("user_id", userId).maybeSingle();
  const emails = [...new Set([u.user?.email, r?.email].filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))];
  for (const e of emails) {
    await admin.from("access_requests").delete().eq("email", e);
    await admin.from("launch_waitlist").delete().eq("email", e);
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error("DELETE_FAILED");
  return "ok";
}
