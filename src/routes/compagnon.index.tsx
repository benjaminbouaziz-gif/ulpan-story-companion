import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

export const Route = createFileRoute("/compagnon/")({
  head: () => ({
    meta: [
      { title: "Espace lecteur — Ulpan Story" },
      {
        name: "description",
        content:
          "Le compagnon des livres Ulpan Story : glossaire, quiz, lecture audio et conversation en hébreu.",
      },
      { property: "og:title", content: "Espace lecteur — Ulpan Story" },
      { property: "og:description", content: "Ce qu'il y a derrière le QR code de votre livre." },
    ],
  }),
  component: CompanionHome,
});

function CompanionHome() {
  const { t } = useI18n();
  return (
    <PageShell>
      <h1 className="text-[30px]">{t("nav.companion")}</h1>
      <p className="body-text mt-4">{t("home.qr.body")}</p>
      <p className="body-text text-secondary-text mt-8">{t("soon")}</p>
    </PageShell>
  );
}
