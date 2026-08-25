import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [
      { title: "Connexion — Ulpan Story" },
      {
        name: "description",
        content: "Recevez un lien de connexion par email. Aucun mot de passe.",
      },
      { property: "og:title", content: "Connexion — Ulpan Story" },
      { property: "og:description", content: "Un lien par email, aucun mot de passe." },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { t } = useI18n();
  return (
    <PageShell>
      <h1 className="text-[30px]">{t("nav.companion")}</h1>
      <p className="body-text text-secondary-text mt-6">{t("soon")}</p>
    </PageShell>
  );
}
