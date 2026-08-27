import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Room } from "@/components/AtelierRoom";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { atelierBookChain, atelierBooks } from "@/lib/atelier-books.functions";

/**
 * La salle des livres — LECTURE SEULE.
 * Aucun bouton d'écriture, aucun champ modifiable : les actions arrivent à la
 * brique 3. Tous les chiffres affichés sont lus en base à l'affichage.
 */
export const Route = createFileRoute("/atelier/livres")({
  head: () => ({
    meta: [{ title: "Livres — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: BooksRoom,
});

const cell = "border-line border-b px-2 py-1 text-left align-top";

function BooksRoom() {
  const { t, lang } = useI18n();
  const list = useServerFn(atelierBooks);
  const chain = useServerFn(atelierBookChain);
  const [openId, setOpenId] = useState<string | null>(null);

  const books = useQuery({ queryKey: ["atelier", "books"], queryFn: () => list() });
  const steps = useQuery({
    queryKey: ["atelier", "chain", openId],
    queryFn: () => chain({ data: { bookId: openId! } }),
    enabled: Boolean(openId),
  });

  const rows = books.data ?? [];

  return (
    <Room titleKey="atelier.room.books" descKey="atelier.room.books.desc">
      <p className="text-[13px]">{t("atelier.readOnly")}</p>

      {books.isLoading ? (
        <p className="mt-4 text-[13px]">…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4">{t("atelier.none")}</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={cell}>{t("atelier.books.col.title")}</th>
              <th className={cell}>{t("atelier.books.col.collection")}</th>
              <th className={cell}>{t("atelier.books.col.status")}</th>
              <th className={cell}>{t("atelier.books.col.step")}</th>
              <th className={cell}>{t("atelier.books.col.validated")}</th>
              <th className={cell}>{t("atelier.books.chain")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td className={cell}>{b.title}</td>
                <td className={cell}>{b.collection ?? t("atelier.none")}</td>
                <td className={cell}>{b.status}</td>
                <td className={cell}>{b.currentStepLabelFr ?? t("atelier.none")}</td>
                <td className={cell}>
                  {b.stepsTotal === 0 ? t("atelier.books.noChain") : `${b.stepsValidated} / ${b.stepsTotal}`}
                </td>
                <td className={cell}>
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === b.id ? null : b.id)}
                    className="border-b border-current"
                  >
                    {openId === b.id ? t("atelier.books.close") : t("atelier.books.chain")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openId ? (
        <div className="mt-8">
          <h2 className="font-latin text-[16px]">{t("atelier.books.chain")}</h2>
          {steps.isLoading ? (
            <p className="mt-2 text-[13px]">…</p>
          ) : (steps.data ?? []).length === 0 ? (
            <p className="mt-2">{t("atelier.books.noChain")}</p>
          ) : (
            <table className="mt-3 w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={cell}>{t("atelier.books.col.rank")}</th>
                  <th className={cell}>{t("atelier.books.col.label")}</th>
                  <th className={cell}>{t("atelier.books.col.species")}</th>
                  <th className={cell}>{t("atelier.books.col.status")}</th>
                  <th className={cell}>{t("atelier.books.col.awaiting")}</th>
                </tr>
              </thead>
              <tbody>
                {(steps.data ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className={cell}>{s.rank}</td>
                    <td className={cell}>{lang === "en" ? s.labelEn : s.labelFr}</td>
                    <td className={cell}>{t(`atelier.species.${s.species}` as DictKey)}</td>
                    <td className={cell}>{t(`atelier.status.${s.status}` as DictKey)}</td>
                    <td className={cell}>
                      {s.awaiting ? t(`atelier.awaiting.${s.awaiting}` as DictKey) : t("atelier.none")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </Room>
  );
}
