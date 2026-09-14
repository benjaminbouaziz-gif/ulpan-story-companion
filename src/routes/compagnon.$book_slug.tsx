import { useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/SiteChrome";
import { HebrewText } from "@/components/HebrewText";
import { QuizRound } from "@/components/QuizRound";
import { LecteurLivre } from "@/components/LecteurLivre";
import { useI18n } from "@/i18n/context";
import {
  getCompanionBook,
  getCompanionPageAudioUrl,
  getCompanionPages,
  saveQuizRound,
} from "@/lib/companion.functions";
import { glossarySense } from "@/lib/spread";

export const Route = createFileRoute("/compagnon/$book_slug")({
  head: () => ({
    meta: [
      { title: "Le compagnon du livre — Ulpan Story" },
      {
        name: "description",
        content: "Glossaire, quiz, lecture audio et conversation en hébreu, offerts avec le livre.",
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
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const fetchBook = useServerFn(getCompanionBook);
  const saveRound = useServerFn(saveQuizRound);
  const fetchPages = useServerFn(getCompanionPages);
  const fetchAudioUrl = useServerFn(getCompanionPageAudioUrl);

  const query = useQuery({
    queryKey: ["companion", "book", book_slug],
    queryFn: () => fetchBook({ data: { slug: book_slug } }),
  });

  const pages = useQuery({
    queryKey: ["companion", "pages", book_slug],
    queryFn: () => fetchPages({ data: { slug: book_slug } }),
  });

  // L'adresse d'écoute n'est demandée qu'au moment de lire.
  const requestAudioUrl = useCallback(
    async (pageId: string) => (await fetchAudioUrl({ data: { pageId } })).url,
    [fetchAudioUrl],
  );

  const round = useMutation({
    mutationFn: (v: { answered: number; correct: number }) =>
      saveRound({ data: { book_slug, answered: v.answered, correct: v.correct } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["companion", "book", book_slug] });
    },
  });

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

  const book = data.book!;
  const accent = data.collection?.color_hex ?? undefined;

  return (
    <PageShell>
      <p className="label text-secondary-text">
        {(lang === "en" ? data.collection?.name_en : data.collection?.name_fr) ?? ""}
      </p>

      <h1 className="mt-1 text-[30px]" style={accent ? { color: accent } : undefined}>
        {lang === "en" ? book.title_en || book.title_fr : book.title_fr}
      </h1>

      {data.progress ? (
        <p className="label text-secondary-text mt-4">
          {t("companion.progress")} — {data.progress.quiz_correct} / {data.progress.quiz_answered}
        </p>
      ) : null}

      {/* Le lecteur : c'est le corps de la page, tout de suite. */}
      <section className="mt-8">
        {pages.isPending ? (
          <p className="label text-secondary-text">{t("companion.loading")}</p>
        ) : (pages.data?.pages.length ?? 0) > 0 ? (
          <LecteurLivre pages={pages.data!.pages} requestAudioUrl={requestAudioUrl} />
        ) : (
          <p className="body-text text-secondary-text">{t("companion.audioSoon")}</p>
        )}
      </section>

      {/* L'entraînement */}
      <section className="mt-12">
        <h2 className="text-[22px]">{t("companion.quiz")}</h2>
        <p className="label text-secondary-text mt-2">{t("companion.quizNote")}</p>
        {data.quiz.length > 0 ? (
          <QuizRound
            questions={data.quiz}
            onFinish={(answered, correct) => round.mutate({ answered, correct })}
          />
        ) : (
          <p className="body-text text-secondary-text mt-4">{t("soon")}</p>
        )}
      </section>

      {/* Le glossaire */}
      <section className="mt-16">
        <h2 className="text-[22px]">{t("companion.glossary")}</h2>
        <p className="label text-secondary-text mt-2">
          {data.glossary.length} {t("companion.words")} — {t("companion.glossaryNote")}
        </p>
        <ul className="border-line mt-6 border-t">
          {data.glossary.map((item) => (
            <li
              key={item.id}
              className="border-line flex items-baseline justify-between gap-6 border-b py-3"
            >
              <HebrewText size="base">{item.lemma_he}</HebrewText>
              <span className="body-text text-secondary-text text-right">
                {glossarySense(item, lang) ?? ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* La lecture audio vit désormais dans le lecteur, page par page.
          `audio_tracks` et sa requête dorment, sans être supprimés. */}
    </PageShell>
  );
}
