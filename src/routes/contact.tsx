import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Ulpan Story" },
      {
        name: "description",
        content: "Écrire à Ulpan Story : une question sur un tome, un niveau, une commande.",
      },
      { property: "og:title", content: "Contact — Ulpan Story" },
      { property: "og:description", content: "Une question sur un tome ou un niveau ? Écrivez-nous." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  return (
    <PageShell>
      <h1 className="text-[30px]">{t("footer.contact")}</h1>
      <p className="body-text mt-6">contact@oulpanstory.com</p>
      <p className="body-text text-secondary-text mt-6">{t("empty.page")}</p>
    </PageShell>
  );
}
