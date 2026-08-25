import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

export const Route = createFileRoute("/activation")({
  head: () => ({
    meta: [
      { title: "Activation — Ulpan Story" },
      {
        name: "description",
        content: "Ouvrez les contenus offerts avec votre livre : lien reçu par email ou code à six chiffres.",
      },
      { property: "og:title", content: "Activation — Ulpan Story" },
      { property: "og:description", content: "Lien par email ou code à six chiffres." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivationPage,
});

function ActivationPage() {
  const { t } = useI18n();
  return (
    <PageShell>
      <h1 className="text-[30px]">{t("nav.companion")}</h1>
      <p className="body-text text-secondary-text mt-6">{t("soon")}</p>
    </PageShell>
  );
}
