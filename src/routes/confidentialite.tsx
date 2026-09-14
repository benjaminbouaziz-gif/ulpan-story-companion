import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { Copy } from "@/components/SiteCopy";
import { useI18n } from "@/i18n/context";
import { pageQuery } from "@/lib/queries";

const PAGE = "confidentialite";

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
      {
        property: "og:description",
        content: "Ce que nous enregistrons, et ce que nous n'enregistrons pas.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pageQuery(PAGE)),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useI18n();
  const { data } = useSuspenseQuery(pageQuery(PAGE));
  return (
    <PageShell>
      <h1 className="text-[30px]">{t("footer.privacy")}</h1>
      <div className="mt-6">
        <Copy sections={data.sections} />
      </div>
    </PageShell>
  );
}
