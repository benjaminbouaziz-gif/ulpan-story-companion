import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { Copy } from "@/components/SiteCopy";
import { useI18n } from "@/i18n/context";
import { pageQuery } from "@/lib/queries";

const PAGE = "mentions-legales";

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
  loader: ({ context }) => context.queryClient.ensureQueryData(pageQuery(PAGE)),
  component: LegalPage,
});

function LegalPage() {
  const { t } = useI18n();
  const { data } = useSuspenseQuery(pageQuery(PAGE));
  return (
    <PageShell>
      <h1 className="text-[30px]">{t("footer.legal")}</h1>
      <div className="mt-6">
        <Copy sections={data.sections} />
      </div>
    </PageShell>
  );
}
