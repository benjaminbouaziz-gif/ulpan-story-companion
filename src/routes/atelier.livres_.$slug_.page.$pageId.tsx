import { createFileRoute, Link } from "@tanstack/react-router";
import { PageEditor } from "@/components/AtelierPageEditor";
import { useI18n } from "@/i18n/context";

/** L'éditeur d'une page du livre : les champs de la page, ses paragraphes, son audio. */
export const Route = createFileRoute("/atelier/livres_/$slug_/page/$pageId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Page du livre — Atelier Ulpan Story" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PageDuLivre,
});

function PageDuLivre() {
  const { t } = useI18n();
  const { slug, pageId } = Route.useParams();
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
      <h1 className="font-latin mt-2 text-[24px]">{t("atelier.livre.page.title")}</h1>
      <div className="border-line mt-6 border-t pt-4">
        <PageEditor pageId={pageId} />
      </div>
    </section>
  );
}
