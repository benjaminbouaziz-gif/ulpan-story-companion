import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { Bandeau } from "@/components/Bandeau";
import { HebrewText } from "@/components/HebrewText";
import { pickLang, useI18n } from "@/i18n/context";
import { collectionQuery } from "@/lib/queries";

export const Route = createFileRoute("/collections/$slug")({
  head: ({ loaderData }) => {
    const name = loaderData?.collection?.name_fr ?? "Collection";
    const tagline =
      loaderData?.collection?.tagline_fr ??
      "Une collection de lectures en hébreu vocalisé.";
    return {
      meta: [
        { title: `${name} — Ulpan Story` },
        { name: "description", content: tagline },
        { property: "og:title", content: `${name} — Ulpan Story` },
        { property: "og:description", content: tagline },
      ],
    };
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(collectionQuery(params.slug)),
  component: CollectionPage,
});

function CollectionPage() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(collectionQuery(slug));
  const collection = data.collection;

  if (!collection) {
    return (
      <PageShell>
        <h1 className="text-[26px]">{t("collections.empty")}</h1>
        <Link to="/collections" className="label touch mt-4 inline-flex border-b border-current">
          {t("nav.collections")}
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-[30px]">{pickLang(lang, collection.name_fr, collection.name_en)}</h1>
      <p className="body-text text-secondary-text mt-3">
        {pickLang(lang, collection.tagline_fr, collection.tagline_en)}
      </p>
      <div className="mt-5">
        <Bandeau color={collection.color_hex}>
          {pickLang(lang, collection.name_fr, collection.name_en) ?? ""}
        </Bandeau>
      </div>

      <p className="body-text mt-8 whitespace-pre-line">
        {pickLang(lang, collection.description_fr, collection.description_en)}
      </p>

      <section className="border-line mt-8 border-t pt-6">
        <h2 className="label text-secondary-text">{t("collections.forWhom")}</h2>
        <p className="body-text mt-2">
          {pickLang(lang, collection.for_whom_fr, collection.for_whom_en)}
        </p>
      </section>

      <section className="border-line mt-8 border-t pt-6">
        <h2 className="text-[22px]">{t("collections.volumes")}</h2>
        {data.books.length === 0 ? (
          <p className="body-text text-secondary-text mt-3">{t("books.empty")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {data.books.map((b) => (
              <li key={b.id} className="border-line border p-4">
                <Link to="/livres/$slug" params={{ slug: b.slug }} className="block">
                  <p className="label text-secondary-text">
                    {t("books.volume")} {b.tome_no}
                  </p>
                  <h3 className="mt-1 text-[20px]">{pickLang(lang, b.title_fr, b.title_en)}</h3>
                  {b.title_he ? <HebrewText className="mt-2">{b.title_he}</HebrewText> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
