import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { Copy } from "@/components/SiteCopy";
import { useI18n } from "@/i18n/context";
import { pageQuery } from "@/lib/queries";

const PAGE = "contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Ulpan Story" },
      {
        name: "description",
        content: "Écrire à Ulpan Story : une question sur un tome, un niveau, une commande.",
      },
      { property: "og:title", content: "Contact — Ulpan Story" },
      {
        property: "og:description",
        content: "Une question sur un tome ou un niveau ? Écrivez-nous.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pageQuery(PAGE)),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  const { data } = useSuspenseQuery(pageQuery(PAGE));
  return (
    <PageShell>
      <h1 className="text-[30px]">{t("footer.contact")}</h1>
      <div className="mt-6">
        <Copy sections={data.sections} />
      </div>
    </PageShell>
  );
}
