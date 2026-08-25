import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { Bandeau } from "@/components/Bandeau";
import { HebrewText } from "@/components/HebrewText";
import { useI18n, pickLang } from "@/i18n/context";
import { collectionsQuery, publishedBooksQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ulpan Story — lire l'hébreu, pas l'étudier" },
      {
        name: "description",
        content:
          "Des livres pour apprendre l'hébreu en lisant de vraies histoires : un passage qui commence en hébreu vocalisé traduit et finit en hébreu seul.",
      },
      { property: "og:title", content: "Ulpan Story — lire l'hébreu, pas l'étudier" },
      {
        property: "og:description",
        content: "Le soutien de votre oulpan : de vraies histoires en hébreu vocalisé.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(collectionsQuery),
      context.queryClient.ensureQueryData(publishedBooksQuery),
    ]);
  },
  component: Home,
});

function Home() {
  const { t, lang } = useI18n();
  const { data: collectionsData } = useSuspenseQuery(collectionsQuery);
  const { data: booksData } = useSuspenseQuery(publishedBooksQuery);
  const collections = collectionsData.collections;
  const books = booksData.books;

  return (
    <PageShell>
      <h1 className="text-[34px]">{t("site.motto")}</h1>
      <p className="body-text mt-4">{t("site.tagline")}</p>
      <p className="body-text text-secondary-text mt-6">{t("home.lede")}</p>

      <section className="border-line mt-12 border-t pt-8">
        <h2 className="text-[24px]">{t("home.method.title")}</h2>
        <Link to="/methode" className="label touch mt-4 inline-flex items-center border-b border-current">
          {t("home.method.link")}
        </Link>
      </section>

      <section className="border-line mt-12 border-t pt-8">
        <h2 className="text-[24px]">{t("home.collections.title")}</h2>
        {collections.length === 0 ? (
          <p className="body-text text-secondary-text mt-4">{t("collections.empty")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {collections.map((c) => (
              <li key={c.id} className="border-line border">
                <Link to="/collections/$slug" params={{ slug: c.slug }} className="block p-4">
                  <h3 className="text-[20px]">{pickLang(lang, c.name_fr, c.name_en)}</h3>
                  <p className="body-text text-secondary-text mt-1">
                    {pickLang(lang, c.tagline_fr, c.tagline_en)}
                  </p>
                </Link>
                <Bandeau color={c.color_hex}>{pickLang(lang, c.name_fr, c.name_en) ?? ""}</Bandeau>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/collections"
          className="label touch mt-4 inline-flex items-center border-b border-current"
        >
          {t("home.collections.link")}
        </Link>
      </section>

      <section className="border-line mt-12 border-t pt-8">
        <h2 className="text-[24px]">{t("home.books.title")}</h2>
        {books.length === 0 ? (
          <p className="body-text text-secondary-text mt-4">{t("books.empty")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {books.map((b) => (
              <li key={b.id} className="border-line border p-4">
                <Link to="/livres/$slug" params={{ slug: b.slug }} className="block">
                  <p className="label text-secondary-text">
                    {t("books.volume")} {b.tome_no}
                  </p>
                  <h3 className="mt-1 text-[20px]">{pickLang(lang, b.title_fr, b.title_en)}</h3>
                  {b.title_he ? (
                    <HebrewText className="mt-2" size="base">
                      {b.title_he}
                    </HebrewText>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-line mt-12 border-t pt-8">
        <h2 className="text-[24px]">{t("home.qr.title")}</h2>
        <p className="body-text mt-3">{t("home.qr.body")}</p>
      </section>
    </PageShell>
  );
}
