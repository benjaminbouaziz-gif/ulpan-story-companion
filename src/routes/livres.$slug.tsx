import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { Bandeau } from "@/components/Bandeau";
import { HebrewText } from "@/components/HebrewText";
import { BookPagesSection } from "@/components/BookPagesSection";
import { SpreadSection } from "@/components/SpreadSection";

import { pickLang, useI18n } from "@/i18n/context";
import { bookQuery } from "@/lib/queries";

export const Route = createFileRoute("/livres/$slug")({
  head: () => ({
    meta: [
      { title: "Un livre — Ulpan Story" },
      {
        name: "description",
        content:
          "La fiche du tome : extrait vocalisé, niveau, ce que vous y apprenez et ce que contient le compagnon.",
      },
      { property: "og:title", content: "Un livre — Ulpan Story" },
      {
        property: "og:description",
        content: "Un extrait réel vaut mieux qu'un argumentaire.",
      },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(bookQuery(params.slug)),
  component: BookPage,
});

function BookPage() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(bookQuery(slug));
  const book = data.book;
  const collection = data.collection;

  if (!book) {
    return (
      <PageShell>
        <h1 className="text-[26px]">{t("books.notFound")}</h1>
        <Link to="/collections" className="label touch mt-4 inline-flex border-b border-current">
          {t("nav.collections")}
        </Link>
      </PageShell>
    );
  }

  const learn = (lang === "en" ? book.what_you_learn_en : book.what_you_learn_fr) as unknown;
  const learnList = Array.isArray(learn) ? (learn as string[]) : [];

  return (
    <PageShell>
      {collection ? (
        <Link
          to="/collections/$slug"
          params={{ slug: collection.slug }}
          className="label touch inline-flex items-center border-b border-current"
        >
          {pickLang(lang, collection.name_fr, collection.name_en)}
        </Link>
      ) : null}

      <p className="label text-secondary-text mt-4">
        {t("books.volume")} {book.tome_no}
      </p>
      <h1 className="mt-1 text-[30px]">{pickLang(lang, book.title_fr, book.title_en)}</h1>
      {book.title_he ? <HebrewText className="mt-3" size="lg">{book.title_he}</HebrewText> : null}

      {collection ? (
        <div className="mt-5">
          <Bandeau color={collection.color_hex}>
            {pickLang(lang, collection.name_fr, collection.name_en) ?? ""}
          </Bandeau>
        </div>
      ) : null}

      <p className="body-text mt-8">{pickLang(lang, book.blurb_fr, book.blurb_en)}</p>

      <section className="border-line mt-8 border-t pt-6">
        <h2 className="text-[22px]">{t("books.excerpt")}</h2>
        {data.pages.length > 0 ? (
          <BookPagesSection
            pages={data.pages}
            words={data.words}
            color={collection?.color_hex ?? null}
            bookTitle={pickLang(lang, book.title_fr, book.title_en) ?? ""}
            showGlossary
          />
        ) : (
          <SpreadSection
            paragraphs={data.paragraphs}
            color={collection?.color_hex ?? null}
            runningHead={
              pickLang(lang, book.spread_running_head_fr, book.spread_running_head_en) ??
              pickLang(lang, book.title_fr, book.title_en) ??
              ""
            }
            chapter={pickLang(lang, book.spread_chapter_fr, book.spread_chapter_en) ?? ""}
            folio={book.spread_folio_left ?? 42}
          />
        )}
      </section>


      {learnList.length > 0 ? (
        <section className="border-line mt-8 border-t pt-6">
          <h2 className="text-[22px]">{t("books.learn")}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {learnList.map((item) => (
              <li key={item} className="body-text">
                — {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-line mt-8 border-t pt-6">
        <p className="label text-secondary-text">
          {book.chapters_count ?? "—"} {t("books.chapters")} · {book.words_unique ?? "—"}{" "}
          {t("books.words")} · {book.page_count ?? "—"} {t("books.pages")}
        </p>
        <p className="body-text text-secondary-text mt-3">
          {pickLang(lang, book.level_note_fr, book.level_note_en)}
        </p>
      </section>
    </PageShell>
  );
}
