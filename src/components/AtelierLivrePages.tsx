import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { atelierLivrePages, createAtelierPage } from "@/lib/atelier-livre.functions";

/** L'onglet « Pages » : le sommaire des pages saisies, une ligne par page. */
const cell = "border-line border-b px-2 py-1 text-left align-top";

export function LivrePagesTable({ bookId, slug }: { bookId: string; slug: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const list = useServerFn(atelierLivrePages);
  const create = useServerFn(createAtelierPage);

  const pages = useQuery({
    queryKey: ["atelier", "livre-pages", bookId],
    queryFn: () => list({ data: { bookId } }),
  });

  async function nouvelle() {
    const res = await create({ data: { bookId } });
    await navigate({ to: "/atelier/livres/$slug/page/$pageId", params: { slug, pageId: res.id } });
  }

  const rows = pages.data ?? [];

  return (
    <div className="mt-6">
      <button
        type="button"
        className="border-line border px-2 py-0.5 text-[13px]"
        onClick={() => void nouvelle()}
      >
        {t("atelier.livre.pages.new")}
      </button>

      {pages.isLoading ? (
        <p className="mt-4 text-[13px]">{t("atelier.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-[13px]">{t("atelier.livre.pages.empty")}</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={cell}>{t("atelier.livre.pages.col.no")}</th>
              <th className={cell}>{t("atelier.livre.pages.col.chapter")}</th>
              <th className={cell}>{t("atelier.livre.pages.col.support")}</th>
              <th className={cell}>{t("atelier.livre.pages.col.audio")}</th>
              <th className={cell}>{t("atelier.livre.pages.col.published")}</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={cell}>{p.pageNo}</td>
                <td className={cell}>{p.chapterNo ?? t("atelier.none")}</td>
                <td className={cell}>{t(`atelier.livre.support.${p.supportKind}` as DictKey)}</td>
                <td className={cell}>
                  {p.hasAudio ? t("atelier.livre.yes") : t("atelier.livre.no")}
                </td>
                <td className={cell}>
                  {p.isPublished ? t("atelier.livre.yes") : t("atelier.livre.no")}
                </td>
                <td className={cell}>
                  <Link
                    to="/atelier/livres/$slug/page/$pageId"
                    params={{ slug, pageId: p.id }}
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
    </div>
  );
}
