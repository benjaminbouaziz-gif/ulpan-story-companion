import { useCallback, useMemo, useState } from "react";
import { useI18n } from "@/i18n/context";
import type { CompanionChapter, QuizQuestion } from "@/lib/companion.functions";
import { fmt } from "@/lib/fmt";
import {
  aRevoir,
  chapitrePropose,
  etatChapitre,
  questionsDuChapitre,
  type Answers,
} from "@/lib/quiz-progress";
import { QuizRound } from "@/components/QuizRound";

/**
 * BRIQUE 9 — l'onglet Entraînement : accueil, séries par chapitre ou « À
 * revoir », bilan. Reste monté quand on passe à la lecture, pour que
 * « Revenir à la question » retrouve exactement la même question.
 */

type Series = {
  key: number;
  kind: "chapter" | "review";
  chapter: number | null;
  qs: QuizQuestion[];
};

type Props = {
  questions: QuizQuestion[];
  chapters: CompanionChapter[];
  initialAnswers: Answers;
  folioFor: (pageNo: number) => number;
  onAnswer: (q: QuizQuestion, chosen: number) => Promise<boolean>;
  onFinish: (answered: number, correct: number) => void;
  onReread: (pageNo: number, from: "question" | "result") => void;
  onFocusMode: (on: boolean) => void;
};

function Ring({ ratio }: { ratio: number }) {
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={34} height={34} viewBox="0 0 34 34" aria-hidden>
      <circle cx={17} cy={17} r={r} fill="none" stroke="var(--surface-rule)" strokeWidth={3} />
      {ratio > 0 ? (
        <circle
          cx={17}
          cy={17}
          r={r}
          fill="none"
          stroke="var(--collection)"
          strokeWidth={3}
          strokeDasharray={`${c * ratio} ${c}`}
          transform="rotate(-90 17 17)"
        />
      ) : null}
    </svg>
  );
}

export function CompanionTraining({
  questions,
  chapters,
  initialAnswers,
  folioFor,
  onAnswer,
  onFinish,
  onReread,
  onFocusMode,
}: Props) {
  const { t, lang } = useI18n();
  const [last, setLast] = useState<Answers>(initialAnswers);
  const [series, setSeries] = useState<Series | null>(null);

  const title = useCallback(
    (no: number | null) => {
      const c = chapters.find((x) => x.chapter_no === no);
      return (lang === "en" ? c?.title_en || c?.title_fr : c?.title_fr || c?.title_en) ?? null;
    },
    [chapters, lang],
  );
  const chapNos = useMemo(() => chapters.map((c) => c.chapter_no), [chapters]);
  const revoir = useMemo(() => aRevoir(questions, last), [questions, last]);

  const start = (kind: Series["kind"], chapter: number | null) => {
    const qs = kind === "review" ? revoir : questionsDuChapitre(questions, chapter!);
    if (qs.length === 0) return;
    setSeries({ key: Date.now(), kind, chapter, qs });
    onFocusMode(true);
  };
  const exit = () => {
    setSeries(null);
    onFocusMode(false);
  };

  const answer = async (q: QuizQuestion, chosen: number) => {
    setLast((l) => ({
      ...l,
      [q.id]: { chosen_index: chosen, is_correct: chosen === q.answer_index },
    }));
    return onAnswer(q, chosen);
  };

  const meta = (c: CompanionChapter, n: number | null) => {
    const bits: string[] = [];
    if (n != null) bits.push(fmt(t("quiz.nQuestions"), { n }));
    if (c.first_page != null && c.last_page != null)
      bits.push(fmt(t("quiz.pages"), { a: folioFor(c.first_page), b: folioFor(c.last_page) }));
    return bits.join(" · ");
  };

  if (series) {
    const nextChap =
      series.kind === "chapter"
        ? chapNos
            .filter((n) => n > (series.chapter ?? 0))
            .find((n) => questionsDuChapitre(questions, n).length > 0)
        : undefined;
    return (
      <QuizRound
        key={series.key}
        questions={series.qs}
        mode={
          series.kind === "review"
            ? { kind: "review" }
            : { kind: "chapter", chapter: series.chapter }
        }
        chapterTitle={title}
        folioFor={folioFor}
        onAnswer={answer}
        onExit={exit}
        onFinish={onFinish}
        onReread={onReread}
        onStage={(s) => onFocusMode(s === "question")}
        next={
          nextChap != null
            ? {
                label: `${fmt(t("quiz.chapter"), { n: nextChap })}${title(nextChap) ? ` · ${title(nextChap)}` : ""}`,
                onClick: () => start("chapter", nextChap),
              }
            : null
        }
      />
    );
  }

  if (questions.length === 0) {
    return <p className="body-text text-secondary-text mt-6">{t("quiz.none")}</p>;
  }

  const propose = chapitrePropose(chapNos, questions, last);
  const anyStarted = chapNos.some((n) => etatChapitre(questions, last, n).commence);
  const proposedChap = chapters.find((c) => c.chapter_no === propose);
  const ui = { fontFamily: "var(--font-ui)" } as const;

  return (
    <div className="mt-6">
      {/* 1. Continuer */}
      <div
        className="bg-paper border-line border p-4"
        style={{ boxShadow: "0 2px 6px var(--surface-rule)" }}
      >
        {proposedChap ? (
          <>
            <div className="flex items-center gap-4">
              <span className="font-latin text-collection text-[64px] leading-none tabular-nums">
                {proposedChap.chapter_no}
              </span>
              <div>
                <p className="label text-secondary-text">
                  {anyStarted ? t("quiz.nextChapter") : t("quiz.start")}
                </p>
                <p className="text-[21px] leading-snug">{title(proposedChap.chapter_no)}</p>
                <p className="text-secondary-text" style={{ ...ui, fontSize: 12.5 }}>
                  {meta(proposedChap, etatChapitre(questions, last, proposedChap.chapter_no).n)}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="touch bg-collection text-ivory mt-4 w-full font-semibold"
              style={{ ...ui, height: 54, fontSize: 15 }}
              onClick={() => start("chapter", proposedChap.chapter_no)}
            >
              {anyStarted ? t("quiz.continue") : t("quiz.begin")}
            </button>
          </>
        ) : revoir.length > 0 ? (
          <button
            type="button"
            className="touch bg-collection text-ivory w-full font-semibold"
            style={{ ...ui, height: 54, fontSize: 15 }}
            onClick={() => start("review", null)}
          >
            {fmt(t("quiz.reviewN"), { n: revoir.length })}
          </button>
        ) : (
          <p className="body-text">{t("quiz.allDone")}</p>
        )}
      </div>

      {/* 2. À revoir */}
      {revoir.length > 0 ? (
        <button
          type="button"
          className="touch bg-alert-soft mt-4 flex w-full items-center gap-3 p-3 text-left"
          onClick={() => start("review", null)}
        >
          <span
            className="bg-alert text-ivory inline-flex h-9 w-9 shrink-0 items-center justify-center tabular-nums"
            style={ui}
          >
            {revoir.length}
          </span>
          <span className="flex-1">
            <span className="block text-[17px]">{t("quiz.review")}</span>
            <span className="text-secondary-text block" style={{ ...ui, fontSize: 12 }}>
              {t("quiz.reviewSub")}
            </span>
          </span>
          <span aria-hidden className="text-[20px]">
            ›
          </span>
        </button>
      ) : null}

      {/* 3. Tous les chapitres */}
      <p className="label text-secondary-text mt-8">{t("quiz.allChapters")}</p>
      <ul className="border-line mt-2 border-t">
        {chapters.map((c) => {
          const e = etatChapitre(questions, last, c.chapter_no);
          const empty = e.n === 0;
          return (
            <li key={c.chapter_no} className="border-line border-b">
              <button
                type="button"
                disabled={empty}
                onClick={() => start("chapter", c.chapter_no)}
                className="touch flex w-full items-center gap-3 py-3 text-left"
                style={empty ? { opacity: 0.42 } : undefined}
              >
                <span className="text-collection w-8 shrink-0 text-[22px] tabular-nums">
                  {c.chapter_no}
                </span>
                <span className="flex-1">
                  <span className="block text-[17px] leading-snug">{title(c.chapter_no)}</span>
                  <span className="text-secondary-text block" style={{ ...ui, fontSize: 12 }}>
                    {meta(c, empty ? null : e.n)}
                  </span>
                </span>
                {empty ? (
                  <span className="label text-secondary-text">{t("quiz.soon")}</span>
                ) : (
                  <Ring ratio={e.commence ? e.reussite : 0} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
