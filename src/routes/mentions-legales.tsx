import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Ulpan Story" },
      {
        name: "description",
        content: "Éditeur, hébergement et contact d'Ulpan Story, maison d'édition indépendante.",
      },
      { property: "og:title", content: "Mentions légales — Ulpan Story" },
      { property: "og:description", content: "Éditeur, hébergement et contact." },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  const { t } = useI18n();
  return (
    <PageShell>
      <h1 className="text-[30px]">{t("footer.legal")}</h1>
      <p className="body-text text-secondary-text mt-6">{t("empty.page")}</p>
      <p className="body-text mt-6">contact@oulpanstory.com</p>
    </PageShell>
  );
}
