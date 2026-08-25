import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

/** L'administration est conçue pour ordinateur et arrive en phase 6. */
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Ulpan Story" },
      { name: "description", content: "Administration interne d'Ulpan Story." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useI18n();
  return (
    <PageShell>
      <h1 className="text-[30px]">Administration</h1>
      <p className="body-text text-secondary-text mt-6">{t("soon")}</p>
    </PageShell>
  );
}
