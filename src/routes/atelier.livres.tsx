import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Room } from "@/components/AtelierRoom";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { atelierBookChain, atelierBooks } from "@/lib/atelier-books.functions";
import { BookFiche, NewBookForm } from "@/components/AtelierBookFiche";
import { BookQcPolicies } from "@/components/AtelierQcPolicies";
import { BookDecisions } from "@/components/AtelierDecisions";

/**
 * La salle des livres. La liste et la chaîne restent lues en base à
 * l'affichage ; chaque étape ouvre son dossier (livrables déposés, liens
 * signés 15 min, porte de validation). Aucune donnée n'est écrite en dur.
 */
export const Route = createFileRoute("/atelier/livres")({
  head: () => ({
    meta: [{ title: "Livres — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    livre: typeof search['livre'] === "string" ? (search['livre'] as string) : undefined,
    etape: typeof search['etape'] === "string" ? (search['etape'] as string) : undefined,
  }),
  component: BooksRoom,
});

const cell = "border-line border-b px-2 py-1 text-left align-top";

function BooksRoom() {
  const { t, lang } = useI18n();
  const list = useServerFn(atelierBooks);
  const chain = useServerFn(atelierBookChain);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const openId = search.livre ?? null;
  const [creating, setCreating] = useState(false);

  const books = useQuery({ queryKey: ["atelier", "books"], queryFn: () => list() });
  const steps = useQuery({
    queryKey: ["atelier", "chain", openId],
    queryFn: () => chain({ data: { bookId: openId! } }),
    enabled: Boolean(openId),
  });

  const rows = books.data ?? [];

  return (
    <Room titleKey="atelier.room.books" descKey="atelier.room.books.desc">
      <div className="mt-4">
        <button
          type="button"
          className="border-line border px-2 py-0.5 text-[13px]"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? t("atelier.books.closeNewBook") : t("atelier.books.newBook")}
        </button>
      </div>
      {creating ? (
        <NewBookForm
          onCreated={(bookId) => {
            setCreating(false);
            void navigate({ to: "/atelier/livres", search: { livre: bookId, etape: undefined } });
          }}
        />
      ) : null}

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
                  <Link
                    to="/atelier/livres"
                    search={
                      openId === b.id
                        ? { livre: undefined, etape: undefined }
                        : { livre: b.id, etape: undefined }
                    }
                    className="border-b border-current"
                  >
                    {openId === b.id ? t("atelier.books.close") : t("atelier.books.chain")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {openId ? (
        <div className="mt-8">
          {/* La chaîne d'abord : c'est l'avancement qu'on vient voir. */}
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
                  <th className={cell}>{t("atelier.step.artifacts")}</th>
                </tr>
              </thead>
              <tbody>
                {(steps.data ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className={cell}>{s.rank}</td>
                    <td className={cell}>{lang === "en" ? s.labelEn : s.labelFr}</td>
                    <td className={cell}>{t(`atelier.species.${s.species}` as DictKey)}</td>
                    <td className={cell}>
                      {t(`atelier.status.${s.status}` as DictKey)}
                      {s.note ? <span className="block opacity-70">{s.note}</span> : null}
                    </td>
                    <td className={cell}>
                      {s.awaiting ? t(`atelier.awaiting.${s.awaiting}` as DictKey) : t("atelier.none")}
                    </td>
                    <td className={cell}>
                      {/* La fiche du livre n'est pas un livrable : elle a son formulaire. */}
                      {s.code === "fiche" ? (
                        <a href="#fiche-du-livre" className="border-b border-current">
                          {t("atelier.books.openFiche")}
                        </a>
                      ) : (
                        <Link
                          to="/atelier/etape/$id"
                          params={{ id: s.id }}
                          className="border-b border-current"
                        >
                          {t("atelier.queue.open")}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* BRIQUE 7 — la mémoire des arbitrages, sous la chaîne. */}
          <BookDecisions bookId={openId} />

          {/* La fiche ensuite, sous son titre, inchangée. */}
          <div id="fiche-du-livre">
            <BookFiche bookId={openId} />
            <BookQcPolicies bookId={openId} />
          </div>
        </div>
      ) : null}
    </Room>
  );
}
