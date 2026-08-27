import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { adminMe } from "@/lib/admin-spread.functions";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

/**
 * La porte. Le rôle est lu en base par une fonction serveur, jamais annoncé par
 * le client. Sans session : retour à la connexion. Session sans rôle : un écran
 * sobre qui ne charge aucune donnée.
 */
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/atelier/connexion" });
    try {
      const me = await adminMe();
      return { isEditor: me.isEditor };
    } catch {
      return { isEditor: false };
    }
  },
  head: () => ({
    meta: [
      { title: "Administration — Ulpan Story" },
      { name: "description", content: "Administration interne d'Ulpan Story." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminGate,
});

function AdminGate() {
  const { isEditor } = Route.useRouteContext();
  const { t } = useI18n();
  if (!isEditor) {
    return (
      <PageShell>
        <h1 className="text-[30px]">{t("admin.forbidden")}</h1>
        <p className="body-text text-secondary-text mt-4">{t("admin.forbiddenBody")}</p>
      </PageShell>
    );
  }
  return <Outlet />;
}
