import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import type { QuizQuestion } from "@/lib/companion.functions";
import { fmt } from "@/lib/fmt";
import { toutEnHebreu } from "@/lib/quiz-progress";

/**
 * BRIQUE 9 — une série de questions. Toucher une tuile vaut réponse ; le
 * panneau de correction glisse du bas ; le bilan clôt la série. Aucun
 * chronomètre, aucun point, aucun son.
 */

export type QuizResult = { q: QuizQuestion; chosen: number; correct: boolean };

type Props = {
  questions: QuizQuestion[];
  mode: { kind: "chapter"; chapter: number | null } | { kind: "review" };
  chapterTitle: (no: number | null) => string | null;
  folioFor?: (pageNo: number) => number;
  /** Enregistre la réponse ; renvoie false si l'enregistrement a échoué. */
  onAnswer?: (q: QuizQuestion, chosen: number) => Promise<boolean>;
  onExit: () => void;
  onFinish?: (answered: number, correct: number) => void;
  onReread?: (pageNo: number, from: "question" | "result") => void;
  next?: { label: string; onClick: () => void } | null;
  onStage?: (stage: "question" | "result") => void;
};

const HEB = /[\u0590-\u05FF]/;
const hebStyle = { letterSpacing: "normal", textTransform: "none" } as const;

/** Isole les passages hébreux d'une explication. */
function Mixte({ text }: { text: string }) {
  const parts = text.split(
    /([\u0590-\u05FF][\u0590-\u05FF\u05B0-\u05C7\s׳״'"־]*[\u0590-\u05FF\u05B0-\u05C7])/,
  );
  return (
    <>
      {parts.map((p, i) =>
        HEB.test(p) ? (
          <span
            key={i}
            dir="rtl"
            lang="he"
            style={{ ...hebStyle, unicodeBidi: "isolate", fontFamily: "var(--font-hebrew)" }}
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function QuizRound({
  questions,
  mode,
  chapterTitle,
  folioFor = (n) => n,
  onAnswer,
  onExit,
  onFinish,
  onReread,
  next,
  onStage,
}: Props) {
  const { t, lang } = useI18n();
  const [list, setList] = useState(() => questions.filter((q) => q.options.length > 1));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [notSaved, setNotSaved] = useState(false);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [done, setDone] = useState(false);
  const nextBtn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => onStage?.(done ? "result" : "question"), [done, onStage]);
  useEffect(() => {
    if (picked !== null) nextBtn.current?.focus();
  }, [picked]);

  if (list.length === 0) return null;

  const chapLabel = (no: number | null) => {
    const title = chapterTitle(no);
    return no == null
      ? (title ?? "")
      : `${fmt(t("quiz.chapter"), { n: no })}${title ? ` · ${title}` : ""}`;
  };

  /* ---------- Bilan ---------- */
  if (done) {
    const justes = results.filter((r) => r.correct).length;
    const rates = results.filter((r) => !r.correct);
    return (
      <div className="pt-4">
        <p className="label text-secondary-text">
          {mode.kind === "review"
            ? t("quiz.reviewDone")
            : fmt(t("quiz.chapterDone"), { n: mode.chapter ?? "" })}
        </p>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="font-latin text-collection text-[96px] leading-none tabular-nums">
            {justes}
          </span>
          <span className="text-secondary-text text-[40px] tabular-nums">/ {results.length}</span>
        </p>
        <p className="body-text mt-2">
          {justes === results.length
            ? t("quiz.allRight")
            : justes === 0
              ? t("quiz.allWrong")
              : t("quiz.rightAnswers")}
        </p>
        <div className="mt-4 flex flex-wrap gap-[6px]">
          {results.map((r, i) => (
            <span
              key={i}
              className={r.correct ? "bg-collection" : "bg-alert"}
              style={{ width: 28, height: 6 }}
            />
          ))}
        </div>

        {rates.length > 0 ? (
          <>
            <p className="label text-secondary-text mt-8">{t("quiz.review")}</p>
            <ul className="bg-paper border-line mt-2 border">
              {rates.map((r) => {
                const good = r.q.options[r.q.answer_index] ?? "";
                const shown = r.q.prompt_he ? r.q.prompt_he.replace(/＿+/g, good) : null;
                return (
                  <li key={r.q.id} className="border-line border-b p-3 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-3">
                      {shown ? (
                        <span
                          dir="rtl"
                          lang="he"
                          className="text-[28px] leading-snug"
                          style={{ ...hebStyle, fontFamily: "var(--font-hebrew)" }}
                        >
                          {shown}
                        </span>
                      ) : (
                        <span
                          className="text-[19px]"
                          {...(HEB.test(good) ? { dir: "rtl", lang: "he" } : {})}
                        >
                          {good}
                        </span>
                      )}
                      {r.q.page_no != null && onReread ? (
                        <button
                          type="button"
                          className="label touch shrink-0 border-b border-current"
                          onClick={() => onReread(r.q.page_no!, "result")}
                        >
                          {fmt(t("quiz.page"), { n: folioFor(r.q.page_no) })}
                        </button>
                      ) : null}
                    </div>
                    <p
                      className="text-secondary-text mt-1"
                      style={{ fontFamily: "var(--font-ui)", fontSize: "12.5px" }}
                    >
                      {shown ? `${good} — ` : ""}
                      {fmt(t("quiz.youChose"), { c: r.q.options[r.chosen] ?? "" })}
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        <div className="mt-8 space-y-3">
          {rates.length > 0 ? (
            <button
              type="button"
              className="touch border-foreground w-full border bg-transparent py-3"
              style={{ fontFamily: "var(--font-ui)" }}
              onClick={() => {
                setList(rates.map((r) => r.q));
                setIndex(0);
                setPicked(null);
                setResults([]);
                setDone(false);
              }}
            >
              {rates.length === 1 ? t("quiz.redoOne") : fmt(t("quiz.redoN"), { n: rates.length })}
            </button>
          ) : null}
          <button
            type="button"
            className="touch bg-collection text-ivory w-full font-semibold"
            style={{ height: 54, fontFamily: "var(--font-ui)", fontSize: 15 }}
            onClick={next ? next.onClick : onExit}
          >
            {next ? next.label : t("quiz.backChapters")}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Question ---------- */
  const q = list[index]!;
  const prompt = (lang === "en" ? q.prompt_en || q.prompt_fr : q.prompt_fr || q.prompt_en) ?? "";
  const explain =
    (lang === "en" ? q.explain_en || q.explain_fr : q.explain_fr || q.explain_en) ?? "";
  const answered = picked !== null;
  const juste = answered && picked === q.answer_index;
  const heb = toutEnHebreu(q.options);
  const oneCol = q.options.some((o) => o.length > 24);
  const progress = (index + (answered ? 1 : 0)) / list.length;
  const good = q.options[q.answer_index] ?? "";
  const last = index + 1 >= list.length;

  async function choose(i: number) {
    if (answered) return;
    setPicked(i);
    setNotSaved(false);
    setResults((r) => [...r, { q, chosen: i, correct: i === q.answer_index }]);
    if (onAnswer) {
      const ok = await onAnswer(q, i).catch(() => false);
      if (!ok) setNotSaved(true);
    }
  }

  function suivante() {
    if (last) {
      const all = results;
      setDone(true);
      onFinish?.(all.length, all.filter((r) => r.correct).length);
    } else {
      setIndex(index + 1);
      setPicked(null);
      setNotSaved(false);
    }
  }

  return (
    <div className="relative pb-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="touch text-[26px] leading-none"
          aria-label={t("quiz.close")}
          onClick={onExit}
        >
          ×
        </button>
        <div className="bg-ivory-2 h-[6px] flex-1">
          <div
            className="bg-collection h-full"
            style={{ width: `${progress * 100}%`, transition: "width 0.35s" }}
          />
        </div>
        <span className="label tabular-nums">
          {index + 1} / {list.length}
        </span>
      </div>

      <p className="label text-secondary-text mt-4">{chapLabel(q.chapter_no)}</p>
      {prompt ? <p className="font-latin mt-1 text-[22px] leading-snug">{prompt}</p> : null}

      {q.prompt_he ? (
        <div className="bg-paper border-line mt-4 border px-3 py-4 text-center">
          <p
            dir="rtl"
            lang="he"
            style={{
              ...hebStyle,
              fontFamily: "var(--font-hebrew)",
              fontSize: /[\s＿]/.test(q.prompt_he.trim()) ? 40 : 54,
              lineHeight: 1.4,
            }}
          >
            {q.prompt_he}
          </p>
        </div>
      ) : null}

      <div className={`mt-4 grid gap-[10px] ${oneCol ? "grid-cols-1" : "grid-cols-2"}`}>
        {q.options.map((option, i) => {
          const isGood = i === q.answer_index;
          let cls = "bg-paper border-line";
          if (answered) {
            if (isGood) cls = "bg-collection text-ivory border-collection";
            else if (i === picked) cls = "bg-alert-soft border-alert text-alert line-through";
            else cls = "bg-paper border-line opacity-40";
          }
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => void choose(i)}
              className={`touch border px-2 py-2 text-center ${cls}`}
              style={{
                minHeight: 64,
                boxShadow: "0 2px 0 var(--surface-rule)",
                ...(heb
                  ? { ...hebStyle, fontFamily: "var(--font-hebrew)", fontSize: 28 }
                  : { fontFamily: "var(--font-latin)", fontSize: 19 }),
              }}
              {...(heb ? { dir: "rtl", lang: "he" } : {})}
            >
              {option}
            </button>
          );
        })}
      </div>

      {answered ? (
        <div
          aria-live="polite"
          className={`quiz-panel safe-bottom sticky bottom-0 z-10 mt-4 px-4 pt-4 ${
            juste ? "bg-collection text-ivory" : "bg-paper border-alert border-t-[3px]"
          }`}
        >
          <p className={`font-latin text-[24px] ${juste ? "" : "text-alert"}`}>
            {juste ? t("quiz.right") : t("quiz.wrong")}
          </p>
          {!juste ? (
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13 }}>
              {t("quiz.theAnswer")}{" "}
              <strong
                {...(HEB.test(good) ? { dir: "rtl", lang: "he" } : {})}
                style={
                  HEB.test(good) ? { ...hebStyle, fontFamily: "var(--font-hebrew)" } : undefined
                }
              >
                {good}
              </strong>
            </p>
          ) : null}
          {explain ? (
            <p className="font-latin mt-2 text-[17px]">
              <Mixte text={explain} />
            </p>
          ) : null}
          {q.page_no != null && onReread ? (
            <button
              type="button"
              className="touch mt-2 font-semibold underline"
              style={{ fontFamily: "var(--font-ui)", fontSize: 13.5 }}
              onClick={() => onReread(q.page_no!, "question")}
            >
              {fmt(t("quiz.reread"), { n: folioFor(q.page_no) })}
            </button>
          ) : null}
          {notSaved ? <p className="label mt-2 opacity-70">{t("quiz.notSaved")}</p> : null}
          <button
            ref={nextBtn}
            type="button"
            className={`touch mt-3 w-full font-semibold ${
              juste ? "bg-ivory text-collection" : "bg-foreground text-background"
            }`}
            style={{ height: 54, fontFamily: "var(--font-ui)", fontSize: 15 }}
            onClick={suivante}
          >
            {last ? t("quiz.seeResult") : t("quiz.next")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
