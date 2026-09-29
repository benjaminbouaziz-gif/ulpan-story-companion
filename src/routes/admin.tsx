import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminWhoAmI } from "@/lib/admin-auth.functions";

/** Enveloppe de l'admin : toute route /admin/* vérifie le rôle éditeur (lu en base). */
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const me = await adminWhoAmI();
      return { editorEmail: me.email };
    } catch {
      throw redirect({ to: "/admin/connexion" });
    }
  },
  head: () => ({ meta: [{ title: "Admin — Ulpan Story" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminShell,
});

const MENU: { to: string; label: string; sub?: string }[] = [
  { to: "/admin/livres", label: "Livres" },
  { to: "/admin/collections", label: "Collections" },
  { to: "/admin/site", label: "Site", sub: "Accueil, Méthode, Pages légales" },
  { to: "/admin/lecteurs", label: "Lecteurs" },
  { to: "/admin/chiffres", label: "Chiffres" },
  { to: "/admin/reglages", label: "Réglages" },
];

function AdminShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/connexion", replace: true });
  }
  return (
    <div className="md:flex md:min-h-screen">
      <aside className="border-line border-b md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <nav className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 md:flex-col md:gap-2 md:py-6">
          <span className="label text-secondary-text hidden md:block">Admin</span>
          {MENU.map((m) => (
            <Link
              key={m.to}
              to={m.to as "/admin/livres"}
              className="label border-b border-transparent py-1"
              activeProps={{ className: "label border-b !border-current py-1" }}
            >
              {m.label}
            </Link>
          ))}
          <button type="button" onClick={() => void signOut()} className="label py-1 text-left">
            Se déconnecter
          </button>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
