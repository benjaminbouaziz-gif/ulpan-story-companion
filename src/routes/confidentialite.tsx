import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Confidentialité — Ulpan Story" },
      {
        name: "description",
        content:
          "Aucun cookie tiers, aucun pixel, aucune mesure publicitaire : ce que nous enregistrons et pourquoi.",
      },
      { property: "og:title", content: "Confidentialité — Ulpan Story" },
      { property: "og:description", content: "Ce que nous enregistrons, et ce que nous n'enregistrons pas." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useI18n();
  return (
    <PageShell>
      <h1 className="text-[30px]">{t("footer.privacy")}</h1>
      <p className="body-text text-secondary-text mt-6">{t("empty.page")}</p>
      <p className="body-text mt-6">contact@oulpanstory.com</p>
    </PageShell>
  );
}
