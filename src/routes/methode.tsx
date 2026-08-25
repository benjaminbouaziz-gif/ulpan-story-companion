import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { PageSections } from "@/components/PageSections";
import { useI18n } from "@/i18n/context";
import { pageQuery } from "@/lib/queries";

const PAGE = "methode";

export const Route = createFileRoute("/methode")({
  head: () => ({
    meta: [
      { title: "La méthode — Ulpan Story" },
      {
        name: "description",
        content:
          "Comment un livre Ulpan Story vous mène de l'hébreu vocalisé avec traduction à l'hébreu seul, sans voyelles : les quatre étapes, la double page et ses règles.",
      },
      { property: "og:title", content: "La méthode — Ulpan Story" },
      {
        property: "og:description",
        content:
          "Les quatre étapes d'un livre Ulpan Story, et la double page telle qu'elle est imprimée.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pageQuery(PAGE)),
  component: MethodPage,
  errorComponent: () => (
    <PageShell>
      <p className="body-text">—</p>
    </PageShell>
  ),
});

function MethodPage() {
  const { t } = useI18n();
  const { data } = useSuspenseQuery(pageQuery(PAGE));

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-[68ch]">
        <h1 className="text-[30px]">{t("nav.method")}</h1>

        <div className="mt-10">
          <PageSections
            sections={data.sections}
            books={data.books}
            spreads={data.spreads}
          />
        </div>
      </div>
    </PageShell>
  );
}
