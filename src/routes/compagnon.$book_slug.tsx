import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

export const Route = createFileRoute("/compagnon/$book_slug")({
  head: () => ({
    meta: [
      { title: "Le compagnon du livre — Ulpan Story" },
      {
        name: "description",
        content: "Glossaire, quiz, lecture audio et conversation en hébreu, offerts avec le livre.",
      },
      { property: "og:title", content: "Le compagnon du livre — Ulpan Story" },
      { property: "og:description", content: "Les contenus offerts avec votre tome." },
    ],
  }),
  component: CompanionBook,
});

function CompanionBook() {
  const { book_slug } = Route.useParams();
  const { t } = useI18n();
  return (
    <PageShell>
      <p className="label text-secondary-text">{book_slug}</p>
      <h1 className="mt-1 text-[30px]">{t("nav.companion")}</h1>
      <p className="body-text text-secondary-text mt-6">{t("soon")}</p>
    </PageShell>
  );
}
