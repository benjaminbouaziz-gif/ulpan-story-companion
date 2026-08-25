import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { Bandeau } from "@/components/Bandeau";
import { pickLang, useI18n } from "@/i18n/context";
import { collectionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/collections/")({
  head: () => ({
    meta: [
      { title: "Les collections — Ulpan Story" },
      {
        name: "description",
        content:
          "Héros d'Israël, Start-Up Nation, Star du Sport, Les Mots Créés, Nouvelles : nos collections de lectures en hébreu vocalisé.",
      },
      { property: "og:title", content: "Les collections — Ulpan Story" },
      {
        property: "og:description",
        content: "Chaque collection, un ton, un niveau, une série de tomes.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(collectionsQuery),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(collectionsQuery);

  return (
    <PageShell>
      <h1 className="text-[30px]">{t("nav.collections")}</h1>
      {data.collections.length === 0 ? (
        <p className="body-text text-secondary-text mt-6">{t("collections.empty")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-6">
          {data.collections.map((c) => (
            <li key={c.id} className="border-line border">
              <Link to="/collections/$slug" params={{ slug: c.slug }} className="block p-4">
                <h2 className="text-[22px]">{pickLang(lang, c.name_fr, c.name_en)}</h2>
                <p className="body-text text-secondary-text mt-2">
                  {pickLang(lang, c.tagline_fr, c.tagline_en)}
                </p>
              </Link>
              <Bandeau color={c.color_hex}>{pickLang(lang, c.name_fr, c.name_en) ?? ""}</Bandeau>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
