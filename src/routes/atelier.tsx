import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { adminMe } from "@/lib/admin-spread.functions";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { useQueryClient } from "@tanstack/react-query";

/**
 * L'ATELIER — poste de pilotage interne, séparé du site public.
 *
 * DEUX PRINCIPES QUE TOUTES LES BRIQUES SUIVANTES DOIVENT RESPECTER :
 *  a. ARTEFACT VERSIONNÉ : chaque étape de fabrication produit une nouvelle
 *     version ; une version ne remplace jamais la précédente, l'historique
 *     se conserve intégralement.
 *  b. DEUX ISSUES : chaque étape se termine par « valider » ou « demander une
 *     révision avec commentaire », qui relance l'étape. Jamais un simple
 *     oui/non sans commentaire.
 *
 * DOCTRINE D'INTERFACE DE L'ATELIER — vaut pour toutes les briques à venir :
 *  - L'atelier est un poste de pilotage, pas une vitrine : tableaux denses,
 *    texte petit mais lisible, information au pixel utile.
 *  - On lit un statut en toutes lettres, jamais par une couleur seule.
 *  - Un état vide se dit en français, jamais par un squelette animé ni une
 *    illustration.
 *  - Aucun chiffre affiché qui ne soit lu en base au moment de l'affichage.
 *  - Toute action destructrice ou irréversible demande une confirmation qui
 *    nomme précisément ce qui va se passer.
 *
 * La porte : le rôle est lu EN BASE par une fonction serveur (adminMe, sous
 * requireSupabaseAuth), jamais annoncé par le client.
 */
export const Route = createFileRoute("/atelier")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/atelier/connexion" });
    try {
      const me = await adminMe();
      return { isEditor: me.isEditor, email: data.user.email ?? "" };
    } catch {
      return { isEditor: false, email: data.user.email ?? "" };
    }
  },
  head: () => ({
    meta: [
      { title: "Atelier — Ulpan Story" },
      { name: "description", content: "Espace de travail interne d'Ulpan Story." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AtelierShell,
});

const ROOMS: { to: string; key: DictKey }[] = [
  { to: "/atelier", key: "atelier.room.dashboard" },
  { to: "/atelier/livres", key: "atelier.room.books" },
  { to: "/atelier/collections", key: "atelier.room.collections" },
  { to: "/atelier/prompts", key: "atelier.room.prompts" },
  { to: "/atelier/robots", key: "atelier.room.robots" },
  { to: "/atelier/site", key: "atelier.room.site" },
  { to: "/atelier/lecteurs", key: "atelier.room.readers" },
  { to: "/atelier/mesure", key: "atelier.room.measure" },
  { to: "/atelier/journal", key: "atelier.room.journal" },
  { to: "/atelier/reglages", key: "atelier.room.settings" },
];

function AtelierShell() {
  const { isEditor, email } = Route.useRouteContext();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!isEditor) {
    return (
      <div className="atelier min-h-[100dvh] p-10">
        <h1 className="font-latin text-[24px]">{t("atelier.forbidden")}</h1>
        <p className="mt-3 text-[14px]">{t("atelier.forbiddenBody")}</p>
      </div>
    );
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/atelier/connexion", replace: true });
  }

  return (
    <div className="atelier flex min-h-[100dvh] w-full">
      <nav className="border-line w-[240px] shrink-0 border-r py-6">
        <p className="font-latin px-6 text-[18px]">{t("atelier.title")}</p>
        <ul className="mt-6">
          {ROOMS.map((room) => (
            <li key={room.to}>
              <Link
                to={room.to}
                activeOptions={{ exact: room.to === "/atelier" }}
                activeProps={{ className: "border-l-2 border-current font-medium" }}
                inactiveProps={{ className: "border-l-2 border-transparent" }}
                className="block px-6 py-2 text-[14px]"
              >
                {t(room.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <header className="border-line flex items-center justify-end gap-4 border-b px-8 py-3">
          <span className="text-[13px]">{email}</span>
          <button type="button" onClick={signOut} className="border-line rounded-[2px] border px-3 py-1 text-[13px]">
            {t("atelier.signOut")}
          </button>
        </header>
        <main className="px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
