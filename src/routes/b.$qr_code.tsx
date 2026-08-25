import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

/** Entrée QR. Le trajet complet (événement, verrou, activation) vient en phase 3. */
export const Route = createFileRoute("/b/$qr_code")({
  head: () => ({
    meta: [
      { title: "Votre livre — Ulpan Story" },
      {
        name: "description",
        content: "Le compagnon du livre que vous tenez : glossaire, quiz, audio et conversation.",
      },
      { property: "og:title", content: "Votre livre — Ulpan Story" },
      { property: "og:description", content: "Ce qu'il y a derrière le QR code." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QrEntry,
});

function QrEntry() {
  const { qr_code } = Route.useParams();
  const { t } = useI18n();
  return (
    <PageShell>
      <p className="label text-secondary-text">{qr_code}</p>
      <h1 className="mt-1 text-[28px]">{t("home.qr.title")}</h1>
      <p className="body-text mt-4">{t("home.qr.body")}</p>
      <p className="body-text text-secondary-text mt-8">{t("soon")}</p>
    </PageShell>
  );
}
