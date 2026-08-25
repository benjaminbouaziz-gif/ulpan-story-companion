import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/context";
import { HebrewText } from "@/components/HebrewText";
import type { QuizQuestion } from "@/lib/companion.functions";

/**
 * L'entraînement. Une question à la fois, quatre réponses, la correction
 * immédiate. Aucune animation, aucun chronomètre : on lit, on choisit.
 */
export function QuizRound({
  questions,
  onFinish,
}: {
  questions: QuizQuestion[];
  onFinish: (answered: number, correct: number) => void;
}) {
  const { t, lang } = useI18n();
  const list = useMemo(() => questions.filter((q) => q.options.length > 1), [questions]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  if (list.length === 0) return null;

  if (done) {
    return (
      <div className="border-line mt-6 border-t pt-6">
        <p className="label">{t("companion.quizDone")}</p>
        <p className="mt-2 text-[28px] tabular-nums">
          {correct} / {list.length}
        </p>
        <button
          type="button"
          className="label touch border-line mt-6 w-full border"
          onClick={() => {
            setIndex(0);
            setPicked(null);
            setCorrect(0);
            setDone(false);
          }}
        >
          {t("companion.quizAgain")}
        </button>
      </div>
    );
  }

  const q = list[index]!;
  const prompt = (lang === "en" ? q.prompt_en : q.prompt_fr) ?? "";
  const explain = (lang === "en" ? q.explain_en : q.explain_fr) ?? null;
  const answered = picked !== null;

  return (
    <div className="border-line mt-6 border-t pt-6">
      <p className="label text-secondary-text">
        {index + 1} / {list.length}
      </p>
      {prompt ? <p className="body-text mt-2">{prompt}</p> : null}
      {q.prompt_he ? (
        <HebrewText size="lg" className="mt-3">
          {q.prompt_he}
        </HebrewText>
      ) : null}


      <ul className="mt-5 space-y-2">
        {q.options.map((option, i) => {
          const isAnswer = i === q.answer_index;
          const state = answered
            ? isAnswer
              ? "border-foreground"
              : i === picked
                ? "border-line opacity-50 line-through"
                : "border-line opacity-50"
            : "border-line";
          return (
            <li key={i}>
              <button
                type="button"
                disabled={answered}
                onClick={() => {
                  setPicked(i);
                  if (isAnswer) setCorrect((c) => c + 1);
                }}
                className={`body-text touch w-full border px-3 py-3 text-left ${state}`}
              >
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {answered ? (
        <>
          {explain ? <p className="label text-secondary-text mt-4">{explain}</p> : null}
          <button
            type="button"
            className="label touch bg-foreground text-background mt-5 w-full"
            onClick={() => {
              if (index + 1 >= list.length) {
                setDone(true);
                onFinish(list.length, correct);
              } else {
                setIndex(index + 1);
                setPicked(null);
              }
            }}
          >
            {index + 1 >= list.length ? t("companion.quizDone") : t("companion.quizNext")}
          </button>
        </>
      ) : null}
    </div>
  );
}
