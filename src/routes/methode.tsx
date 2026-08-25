import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { HebrewText } from "@/components/HebrewText";
import { pickLang, useI18n } from "@/i18n/context";
import { pageQuery } from "@/lib/queries";

export const Route = createFileRoute("/methode")({
  head: () => ({
    meta: [
      { title: "La méthode — Ulpan Story" },
      {
        name: "description",
        content:
          "Page de gauche en hébreu vocalisé, page de droite un soutien qui se retire au fil du livre, jusqu'à lire sans nekoudot.",
      },
      { property: "og:title", content: "La méthode — Ulpan Story" },
      {
        property: "og:description",
        content: "Ce que le livre fait, et ce qu'il ne fait pas.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pageQuery("methode")),
  component: MethodPage,
  errorComponent: () => <PageShell><p className="body-text">—</p></PageShell>,
});

function MethodPage() {
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(pageQuery("methode"));

  return (
    <PageShell>
      <h1 className="text-[30px]">{t("nav.method")}</h1>

      {data.sections.length === 0 ? (
        <>
          <p className="body-text text-secondary-text mt-6">{t("empty.page")}</p>
          <div className="border-line mt-8 border p-4">
            <p className="label text-secondary-text">{t("home.method.left")}</p>
            <HebrewText className="mt-3">
              הוּא לָמַד עִבְרִית בַּבַּיִת, וְעַרְבִית בָּרְחוֹב.
            </HebrewText>
            <p className="body-text border-line mt-4 border-t pt-4">
              {lang === "en"
                ? "He learned Hebrew at home, and Arabic in the street."
                : "Il a appris l'hébreu à la maison, et l'arabe dans la rue."}
            </p>
          </div>
        </>
      ) : (
        <div className="mt-6 flex flex-col gap-10">
          {data.sections.map((s) => (
            <section key={s.id}>
              <h2 className="text-[22px]">{pickLang(lang, s.title_fr, s.title_en)}</h2>
              <p className="body-text mt-3 whitespace-pre-line">
                {pickLang(lang, s.body_fr, s.body_en)}
              </p>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
