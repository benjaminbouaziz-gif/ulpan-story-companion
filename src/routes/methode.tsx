import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { SpreadSection } from "@/components/SpreadSection";
import { pickLang, useI18n } from "@/i18n/context";
import { showcaseQuery } from "@/lib/queries";

export const Route = createFileRoute("/methode")({
  head: () => ({
    meta: [
      { title: "La méthode — Ulpan Story" },
      {
        name: "description",
        content:
          "La double page du livre, reproduite au millimètre : hébreu à gauche, soutien à droite, quatre étapes jusqu'à l'hébreu seul.",
      },
      { property: "og:title", content: "La méthode — Ulpan Story" },
      {
        property: "og:description",
        content: "La double page du livre, à ses proportions réelles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(showcaseQuery),
  component: MethodPage,
  errorComponent: () => (
    <PageShell>
      <p className="body-text">—</p>
    </PageShell>
  ),
});

function MethodPage() {
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(showcaseQuery);
  const book = data.book;

  return (
    <PageShell>
      <h1 className="text-[30px]">{t("nav.method")}</h1>
      <SpreadSection
        paragraphs={data.paragraphs}
        color={data.collection?.color_hex ?? null}
        runningHead={
          pickLang(lang, book?.spread_running_head_fr, book?.spread_running_head_en) ??
          pickLang(lang, book?.title_fr, book?.title_en) ??
          ""
        }
        chapter={pickLang(lang, book?.spread_chapter_fr, book?.spread_chapter_en) ?? ""}
        folio={book?.spread_folio_left ?? 42}
      />
    </PageShell>
  );
}
