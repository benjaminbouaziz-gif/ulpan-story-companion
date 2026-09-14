import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Room } from "@/components/AtelierRoom";
import { useI18n } from "@/i18n/context";
import { atelierLivres } from "@/lib/atelier-livre.functions";

/**
 * LA LISTE DES LIVRES. Une ligne par livre, deux compteurs lus en base à
 * l'affichage : pages créées, pages sonorisées. Aucun chiffre décoratif.
 */
export const Route = createFileRoute("/atelier/livres")({
  head: () => ({
    meta: [{ title: "Livres — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: BooksRoom,
});

const cell = "border-line border-b px-2 py-1 text-left align-top";

function BooksRoom() {
  const { t } = useI18n();
  const list = useServerFn(atelierLivres);
  const books = useQuery({ queryKey: ["atelier", "livres"], queryFn: () => list() });
  const rows = books.data ?? [];

  return (
    <Room titleKey="atelier.room.books" descKey="atelier.livre.desc">
      {books.isLoading ? (
        <p className="text-[13px]">{t("atelier.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px]">{t("atelier.livre.emptyList")}</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={cell}>{t("atelier.livre.col.title")}</th>
              <th className={cell}>{t("atelier.livre.col.tome")}</th>
              <th className={cell}>{t("atelier.livre.col.collection")}</th>
              <th className={cell}>{t("atelier.livre.col.qr")}</th>
              <th className={cell}>{t("atelier.livre.col.status")}</th>
              <th className={cell}>{t("atelier.livre.col.pages")}</th>
              <th className={cell}>{t("atelier.livre.col.audios")}</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td className={cell}>{b.title}</td>
                <td className={cell}>{b.tomeNo ?? t("atelier.none")}</td>
                <td className={cell}>{b.collection ?? t("atelier.none")}</td>
                <td className={cell}>{b.qrCode}</td>
                <td className={cell}>{b.status}</td>
                <td className={cell}>{b.pages}</td>
                <td className={cell}>{b.pagesWithAudio}</td>
                <td className={cell}>
                  <Link
                    to="/atelier/livres/$slug"
                    params={{ slug: b.slug }}
                    search={{ onglet: "info" as const }}
                    className="border-b border-current"
                  >
                    {t("atelier.livre.open")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Room>
  );
}
