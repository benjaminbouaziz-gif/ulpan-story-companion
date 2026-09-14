import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { LivreInfoForm } from "@/components/AtelierLivreInfo";
import { LivrePagesTable } from "@/components/AtelierLivrePages";
import { atelierLivreCollections, atelierLivreInfo } from "@/lib/atelier-livre.functions";

/**
 * LA FICHE DU LIVRE. Deux onglets actifs : Informations et Pages. Les trois
 * autres sont annoncés, désactivés, et n'appellent rien.
 */
type Onglet = "info" | "pages";

export const Route = createFileRoute("/atelier/livres_/$slug")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Livre — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    onglet: (search["onglet"] === "pages" ? "pages" : "info") as Onglet,
  }),
  component: FicheLivre,
});

const ONGLETS_A_VENIR: DictKey[] = [
  "atelier.livre.tab.glossary",
  "atelier.livre.tab.quiz",
  "atelier.livre.tab.talk",
];

function FicheLivre() {
  const { t } = useI18n();
  const { slug } = Route.useParams();
  const { onglet } = Route.useSearch();
  const navigate = useNavigate();
  const readInfo = useServerFn(atelierLivreInfo);
  const readCollections = useServerFn(atelierLivreCollections);

  const info = useQuery({
    queryKey: ["atelier", "livre", slug],
    queryFn: () => readInfo({ data: { slug } }),
  });
  const collections = useQuery({
    queryKey: ["atelier", "livre-collections"],
    queryFn: () => readCollections(),
  });

  if (info.isLoading) return <p className="text-[13px]">{t("atelier.loading")}</p>;
  const book = info.data;
  if (!book) return <p className="text-[13px]">{t("atelier.livre.notFound")}</p>;

  const tab = "border-line border px-3 py-1 text-[13px]";

  return (
    <section>
      <p className="text-[13px]">
        <Link to="/atelier/livres" className="border-b border-current">
          {t("atelier.livre.back")}
        </Link>
      </p>
      <h1 className="font-latin mt-2 text-[24px]">{book.titleFr}</h1>
      <p className="mt-1 text-[13px]">
        {book.tomeNo ? `${t("atelier.livre.col.tome")} ${book.tomeNo} · ` : ""}
        {book.collectionName ?? t("atelier.livre.noCollection")} · {t("atelier.livre.col.qr")}{" "}
        {book.qrCode}
      </p>

      <div className="border-line mt-6 flex flex-wrap items-center gap-2 border-b pb-3">
        <button
          type="button"
          className={`${tab} ${onglet === "info" ? "font-medium" : ""}`}
          onClick={() => void navigate({ to: ".", search: { onglet: "info" } })}
        >
          {t("atelier.livre.tab.info")}
        </button>
        <button
          type="button"
          className={`${tab} ${onglet === "pages" ? "font-medium" : ""}`}
          onClick={() => void navigate({ to: ".", search: { onglet: "pages" } })}
        >
          {t("atelier.livre.tab.pages")}
        </button>
        {ONGLETS_A_VENIR.map((key) => (
          <span key={key} className={`${tab} opacity-50`}>
            {t(key)} — {t("atelier.livre.tab.soon")}
          </span>
        ))}
      </div>

      {onglet === "info" ? (
        <LivreInfoForm
          info={book}
          collections={collections.data ?? []}
          onSaved={(nouveauSlug) => {
            if (nouveauSlug !== slug) {
              void navigate({
                to: "/atelier/livres/$slug",
                params: { slug: nouveauSlug },
                search: { onglet: "info" },
              });
            } else {
              void info.refetch();
            }
          }}
        />
      ) : (
        <LivrePagesTable bookId={book.id} slug={book.slug} />
      )}
    </section>
  );
}
