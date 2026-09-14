import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CollerLivre } from "@/components/AtelierCollerLivre";
import { useI18n } from "@/i18n/context";
import { atelierLivreInfo } from "@/lib/atelier-livre.functions";

/** BRIQUE 7 — l'écran dédié au collage d'un livre entier. */
export const Route = createFileRoute("/atelier/livres_/$slug_/coller")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Coller le livre — Atelier Ulpan Story" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CollerPage,
});

function CollerPage() {
  const { t } = useI18n();
  const { slug } = Route.useParams();
  const read = useServerFn(atelierLivreInfo);

  const info = useQuery({
    queryKey: ["atelier", "livre-info", slug],
    queryFn: () => read({ data: { slug } }),
  });

  return (
    <section>
      <p className="text-[13px]">
        <Link
          to="/atelier/livres/$slug"
          params={{ slug }}
          search={{ onglet: "pages" as const }}
          className="border-b border-current"
        >
          {t("atelier.livre.page.back")}
        </Link>
      </p>
      <h1 className="font-latin mt-2 text-[24px]">{t("atelier.livre.coller.title")}</h1>
      <div className="border-line mt-6 border-t pt-4">
        {info.isLoading ? (
          <p className="text-[13px]">{t("atelier.loading")}</p>
        ) : !info.data ? (
          <p className="text-[13px]">{t("atelier.livre.page.notFound")}</p>
        ) : (
          <CollerLivre bookId={info.data.id} slug={slug} />
        )}
      </div>
    </section>
  );
}
