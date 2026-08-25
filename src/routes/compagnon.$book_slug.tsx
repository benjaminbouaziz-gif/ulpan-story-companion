import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/SiteChrome";
import { HebrewText } from "@/components/HebrewText";
import { QuizRound } from "@/components/QuizRound";
import { useI18n } from "@/i18n/context";
import { getCompanionBook, saveQuizRound } from "@/lib/companion.functions";
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

  const query = useQuery({
    queryKey: ["companion", "book", book_slug],
    queryFn: () => fetchBook({ data: { slug: book_slug } }),
  });

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
      <p className="label text-secondary-text">{data.collection?.title_fr ?? ""}</p>
      <h1 className="mt-1 text-[30px]" style={accent ? { color: accent } : undefined}>
        {lang === "en" ? book.title_en || book.title_fr : book.title_fr}
      </h1>

      {data.progress ? (
        <p className="label text-secondary-text mt-4">
          {t("companion.progress")} — {data.progress.quiz_correct} / {data.progress.quiz_answered}
        </p>
      ) : null}

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

      {/* La lecture audio */}
      <section className="mt-16">
        <h2 className="text-[22px]">{t("companion.audio")}</h2>
        {data.audio.length > 0 ? (
          <ul className="border-line mt-6 border-t">
            {data.audio.map((track) => (
              <li key={track.id} className="border-line border-b py-3">
                <span className="body-text">
                  {(lang === "en" ? track.label_en : track.label_fr) ??
                    `${t("companion.audio")} ${track.chapter_no ?? ""}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="body-text text-secondary-text mt-4">{t("companion.audioSoon")}</p>
        )}
      </section>
    </PageShell>
  );
}
