import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { MirrorReader } from "@/components/MirrorReader";
import { pickLang, useI18n } from "@/i18n/context";
import { pageQuery, showcaseQuery } from "@/lib/queries";

export const Route = createFileRoute("/methode")({
  head: () => ({
    meta: [
      { title: "La méthode — Ulpan Story" },
      {
        name: "description",
        content:
          "Page de gauche en hébreu vocalisé, page de droite un soutien qui se retire au fil du livre, jusqu'à lire sans nekoudot. Essayez le miroir.",
      },
      { property: "og:title", content: "La méthode — Ulpan Story" },
      {
        property: "og:description",
        content: "Bougez le curseur : le soutien se retire, l'hébreu reste.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(pageQuery("methode")),
      context.queryClient.ensureQueryData(showcaseQuery),
    ]);
  },
  component: MethodPage,
  errorComponent: () => (
    <PageShell>
      <p className="body-text">—</p>
    </PageShell>
  ),
});

function MethodPage() {
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(pageQuery("methode"));
  const { data: showcase } = useSuspenseQuery(showcaseQuery);

  return (
    <PageShell>
      <h1 className="text-[30px]">{t("nav.method")}</h1>
      <p className="body-text mt-4">{t("home.method.left")}</p>
      <p className="body-text">{t("home.method.right")}</p>

      <section className="mt-8">
        <h2 className="text-[22px]">{t("mirror.title")}</h2>
        <p className="body-text text-secondary-text mt-2">{t("mirror.tryIt")}</p>
        <p className="body-text text-secondary-text">{t("mirror.longPress")}</p>
        <div className="mt-5">
          <MirrorReader
            segments={showcase.segments}
            color={showcase.collection?.color_hex ?? null}
          />
        </div>
        {showcase.book ? (
          <Link
            to="/livres/$slug"
            params={{ slug: showcase.book.slug }}
            className="label touch mt-4 inline-flex items-center border-b border-current"
          >
            {pickLang(lang, showcase.book.title_fr, showcase.book.title_en)}
          </Link>
        ) : null}
      </section>

      {data.sections.length > 0 ? (
        <div className="mt-12 flex flex-col gap-10">
          {data.sections.map((s) => (
            <section key={s.id} className="border-line border-t pt-6">
              <h2 className="text-[22px]">{pickLang(lang, s.title_fr, s.title_en)}</h2>
              <p className="body-text mt-3 whitespace-pre-line">
                {pickLang(lang, s.body_fr, s.body_en)}
              </p>
            </section>
          ))}
        </div>
      ) : null}
    </PageShell>
  );
}
