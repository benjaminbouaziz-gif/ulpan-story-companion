import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/SiteChrome";
import { useI18n } from "@/i18n/context";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Administration — Ulpan Story" },
      { name: "description", content: "Outils internes d'Ulpan Story." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const { t } = useI18n();
  return (
    <PageShell>
      <h1 className="text-[30px]">Administration</h1>
      <Link
        to="/admin/extraits"
        className="label touch mt-6 inline-flex items-center border-b border-current"
      >
        {t("admin.excerpt")}
      </Link>
      <p className="body-text text-secondary-text mt-8">{t("soon")}</p>
    </PageShell>
  );
}
