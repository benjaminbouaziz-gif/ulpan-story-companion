import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { Excerpt, GlossaryList } from "@/components/Excerpt";
import { Spread } from "@/components/Spread";

import { pickLang, useI18n } from "@/i18n/context";
import { showcaseQuery } from "@/lib/queries";

export const Route = createFileRoute("/methode")({
  head: () => ({
    meta: [
      { title: "La méthode — Ulpan Story" },
      {
        name: "description",
        content:
          "Un passage à lire jusqu'en bas : l'hébreu vocalisé au départ, l'hébreu seul à l'arrivée. La méthode se montre, elle ne s'explique pas.",
      },
      { property: "og:title", content: "La méthode — Ulpan Story" },
      {
        property: "og:description",
        content: "Lisez ce passage jusqu'en bas.",
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

  return (
    <PageShell>
      <h1 className="text-[30px]">{t("nav.method")}</h1>
      <p className="body-text mt-6">{t("excerpt.before")}</p>

      {data.paragraphs.length > 0 && data.book ? (
        <section className="mt-10">
          <Spread
            paragraphs={data.paragraphs}
            color={data.collection?.color_hex ?? null}
            title={pickLang(lang, data.book.title_fr, data.book.title_en) ?? ""}
            chapter={t("spread.chapter")}
          />
          <p className="label text-secondary-text mt-3">{t("spread.caption")}</p>
          <p className="body-text mt-2">{t("spread.watch")}</p>
          <a
            href="#lecture"
            className="label touch mt-4 inline-flex items-center border-b border-current"
          >
            {t("spread.read")}
          </a>
        </section>
      ) : null}

      <div id="lecture" className="border-line mt-14 border-t pt-10">
        <Excerpt paragraphs={data.paragraphs} color={data.collection?.color_hex ?? null} />
      </div>

      <div className="mx-auto mt-10 max-w-[65ch]">
        <p className="body-text">{t("excerpt.after1")}</p>
        <p className="body-text">{t("excerpt.after2")}</p>
      </div>


      {data.glossary.length > 0 ? (
        <section className="border-line mt-14 border-t pt-8">
          <h2 className="mx-auto max-w-[65ch] text-[22px]">{t("excerpt.glossary")}</h2>
          <div className="mt-5">
            <GlossaryList items={data.glossary} />
          </div>
          <p className="body-text text-secondary-text mx-auto mt-5 max-w-[65ch] text-[0.85em]">
            {t("excerpt.glossaryFull")}
          </p>
        </section>
      ) : null}

      {data.book ? (
        <Link
          to="/livres/$slug"
          params={{ slug: data.book.slug }}
          className="label touch mx-auto mt-10 flex max-w-[65ch] items-center border-b border-current"
        >
          {pickLang(lang, data.book.title_fr, data.book.title_en)}
        </Link>
      ) : null}
    </PageShell>
  );
}
