import { useCallback, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/SiteChrome";
import { LecteurLivre } from "@/components/LecteurLivre";
import { CompanionTraining } from "@/components/CompanionTraining";
import { pickLang, useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import {
  enregistrerReponse,
  getCompanionBook,
  getCompanionGlossaryUrl,
  getCompanionPageAudioUrl,
  getCompanionPages,
  saveQuizRound,
} from "@/lib/companion.functions";

type Onglet = "lecture" | "entrainement" | "glossaire";
const ONGLETS: { id: Onglet; key: DictKey }[] = [
  { id: "lecture", key: "companion.tab.lecture" },
  { id: "entrainement", key: "companion.tab.entrainement" },
  { id: "glossaire", key: "companion.tab.glossaire" },
];

export const Route = createFileRoute("/compagnon/$book_slug")({
  validateSearch: (search: Record<string, unknown>): { onglet?: Onglet } => {
    const o = search["onglet"];
    return o === "entrainement" || o === "glossaire" || o === "lecture" ? { onglet: o } : {};
  },
  head: () => ({
    meta: [
      { title: "Le compagnon du livre — Ulpan Story" },
      {
        name: "description",
        content: "Lecture audio, entraînement et glossaire, offerts avec le livre.",
      },
      { property: "og:title", content: "Le compagnon du livre — Ulpan Story" },
      { property: "og:description", content: "Les contenus offerts avec votre tome." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompanionBook,
});

function CompanionBook() {
  const { book_slug } = Route.useParams();
  const onglet: Onglet = Route.useSearch().onglet ?? "lecture";
  const navigate = useNavigate({ from: Route.fullPath });
  const { t, lang } = useI18n();
  const fetchBook = useServerFn(getCompanionBook);
  const saveRound = useServerFn(saveQuizRound);
  const saveAnswer = useServerFn(enregistrerReponse);
  const fetchPages = useServerFn(getCompanionPages);
  const fetchAudioUrl = useServerFn(getCompanionPageAudioUrl);
  const fetchGlossaryUrl = useServerFn(getCompanionGlossaryUrl);
  const [glossaryBusy, setGlossaryBusy] = useState(false);

  const [focus, setFocus] = useState(false);
  const [readerPage, setReaderPage] = useState<number | undefined>(undefined);
  const [retour, setRetour] = useState<"question" | "result" | null>(null);

  const query = useQuery({
    queryKey: ["companion", "book", book_slug, lang],
    queryFn: () => fetchBook({ data: { slug: book_slug, lang } }),
    staleTime: Infinity,
  });
  const pages = useQuery({
    queryKey: ["companion", "pages", book_slug],
    queryFn: () => fetchPages({ data: { slug: book_slug } }),
  });

  const requestAudioUrl = useCallback(
    async (pageId: string) => (await fetchAudioUrl({ data: { pageId } })).url,
    [fetchAudioUrl],
  );

  const round = useMutation({
    mutationFn: (v: { answered: number; correct: number }) =>
      saveRound({ data: { book_slug, answered: v.answered, correct: v.correct } }),
  });

  const go = (o: Onglet) => void navigate({ search: { onglet: o } });

  if (query.isPending) {
    return (
      <PageShell>
        <p className="body-text">{t("companion.loading")}</p>
      </PageShell>
    );
  }

  const data = query.data;
  if (!data || !data.allowed) {
    return (
      <PageShell>
        <h1 className="text-[28px]">{t("companion.locked")}</h1>
        <p className="body-text mt-4">{t("companion.lockedBody")}</p>
        <Link to="/compagnon" className="label touch mt-6 inline-flex border-b border-current">
          {t("nav.companion")}
        </Link>
      </PageShell>
    );
  }

  if (data.unavailable) {
    return (
      <PageShell>
        <h1 className="text-[28px]">{t("companion.unavailable")}</h1>
        <p className="body-text mt-4">{t("companion.unavailableBody")}</p>
        <Link to="/compagnon" className="label touch mt-6 inline-flex border-b border-current">
          {t("nav.companion")}
        </Link>
      </PageShell>
    );
  }

  const book = data.book!;
  const folios = new Map(data.folios.map((f) => [f.page_no, f.folio ?? f.page_no]));
  const folioFor = (n: number) => folios.get(n) ?? n;
  const concentre = focus && onglet === "entrainement";
  const collStyle = data.collection?.color_hex
    ? ({ "--collection": data.collection.color_hex } as React.CSSProperties)
    : undefined;

  return (
    <PageShell>
      <div style={collStyle}>
        <div className="bg-collection text-ivory px-4 pt-4">
          {!concentre ? (
            <>
              <p className="label" style={{ opacity: 0.7 }}>
                {pickLang(lang, data.collection?.name_fr, data.collection?.name_en) ?? ""}
                {book.tome_no ? ` · ${book.tome_no}` : ""}
              </p>
              <h1 className="font-latin mt-1 text-[30px] font-normal">
                {pickLang(lang, book.title_fr, book.title_en) ?? ""}
              </h1>
            </>
          ) : null}
          <div role="tablist" className="mt-3 flex gap-5">
            {ONGLETS.map((o) => {
              const active = onglet === o.id;
              return (
                <button
                  key={o.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => go(o.id)}
                  className="touch border-b-2 pb-2"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    borderColor: active ? "currentColor" : "transparent",
                    opacity: active ? 1 : 0.6,
                  }}
                >
                  {t(o.key)}
                </button>
              );
            })}
          </div>
        </div>

        <div role="tabpanel" hidden={onglet !== "lecture"} className="mt-6">
          {pages.isPending ? (
            <p className="label text-secondary-text">{t("companion.loading")}</p>
          ) : (pages.data?.pages.length ?? 0) > 0 ? (
            <LecteurLivre
              pages={pages.data!.pages}
              requestAudioUrl={requestAudioUrl}
              initialPageNo={readerPage}
              retour={
                retour
                  ? {
                      label: retour === "question" ? t("quiz.backQuestion") : t("quiz.backResult"),
                      onClick: () => {
                        setRetour(null);
                        go("entrainement");
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <p className="body-text text-secondary-text">{t("companion.audioSoon")}</p>
          )}
        </div>

        <div role="tabpanel" hidden={onglet !== "entrainement"}>
          {data.quiz.length === 0 ? (
            <p className="body-text text-secondary-text mt-6">{t("companion.trainingSoon")}</p>
          ) : (
          <CompanionTraining
            questions={data.quiz}
            chapters={data.chapters}
            initialAnswers={data.lastAnswers}
            folioFor={folioFor}
            onAnswer={async (q, chosen) => {
              try {
                await saveAnswer({ data: { book_slug, question_id: q.id, chosen_index: chosen } });
                return true;
              } catch {
                return false;
              }
            }}
            onFinish={(answered, correct) => round.mutate({ answered, correct })}
            onReread={(pageNo, from) => {
              setReaderPage(pageNo);
              setRetour(from);
              go("lecture");
            }}
            onFocusMode={setFocus}
          />
          )}
        </div>

        <div role="tabpanel" hidden={onglet !== "glossaire"} className="mt-6">
          {data.hasGlossaryFile ? (
            <button
              type="button"
              disabled={glossaryBusy}
              className="label touch bg-foreground text-background px-4 disabled:opacity-40"
              onClick={async () => {
                setGlossaryBusy(true);
                try {
                  const { url } = await fetchGlossaryUrl({ data: { slug: book_slug, lang } });
                  if (url) window.location.href = url;
                } finally {
                  setGlossaryBusy(false);
                }
              }}
            >
              {t("companion.glossaryDownload")}
            </button>
          ) : (
            <p className="body-text text-secondary-text">{t("companion.glossarySoon")}</p>
          )}
        </div>
      </div>
    </PageShell>
  );
}
