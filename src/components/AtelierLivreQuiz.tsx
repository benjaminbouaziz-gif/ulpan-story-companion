import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { fmt } from "@/lib/fmt";
import { useAtelierRefresh } from "@/lib/atelier-refresh";
import { atelierLivrePages } from "@/lib/atelier-livre.functions";
import {
  analyserQuiz,
  exporterQuiz,
  importerQuiz,
  statsQuiz,
  type AnalyseReponse,
} from "@/lib/atelier-quiz.functions";
import { analyserQuizJson, type QuizProbleme } from "@/lib/quiz-json";
import type { QuizQuestion } from "@/lib/companion.functions";
import { QuizRound } from "@/components/QuizRound";

/**
 * BRIQUE 9 — l'onglet Quiz. Même principe que le collage : l'analyse n'écrit
 * rien ; « Mettre en ligne » ne s'active qu'après une analyse sans erreur, et
 * le serveur relance l'analyse avant d'écrire.
 */

const btn = "border-line border px-3 py-1 text-[13px] disabled:opacity-40";

export function LivreQuiz({
  bookId,
  slug,
  edition,
}: {
  bookId: string;
  slug: string;
  edition: "fr" | "en";
}) {
  const { t } = useI18n();
  const refresh = useAtelierRefresh();
  const readStats = useServerFn(statsQuiz);
  const readExport = useServerFn(exporterQuiz);
  const analyse = useServerFn(analyserQuiz);
  const importer = useServerFn(importerQuiz);
  const readPages = useServerFn(atelierLivrePages);

  const stats = useQuery({
    queryKey: ["atelier", "quiz-stats", bookId, edition],
    queryFn: () => readStats({ data: { bookId, edition } }),
  });
  const pages = useQuery({
    queryKey: ["atelier", "livre-pages", bookId],
    queryFn: () => readPages({ data: { bookId } }),
  });

  const [nom, setNom] = useState<string | null>(null);
  const [contenu, setContenu] = useState<string | null>(null);
  const [coller, setColler] = useState(false);
  const [texte, setTexte] = useState("");
  const [rapport, setRapport] = useState<AnalyseReponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function lancer(src: string, name: string | null) {
    setContenu(src);
    setNom(name);
    setPreview(false);
    setConfirm(false);
    setMessage(null);
    setBusy(true);
    try {
      setRapport(await analyse({ data: { bookId, edition, contenu: src } }));
    } catch {
      setRapport(null);
      setMessage(t("atelier.quiz.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function lireFichier(f: File | undefined) {
    if (!f) return;
    await lancer(await f.text(), f.name);
  }

  // Les questions de l'aperçu : recalculées localement avec le même contrat.
  const apercu: QuizQuestion[] = useMemo(() => {
    if (!contenu || !rapport || rapport.erreurs.length > 0) return [];
    const refs = (pages.data ?? []).map((p) => ({ page_no: p.pageNo, chapter_no: p.chapterNo }));
    return analyserQuizJson(contenu, slug, refs, edition).lignes.map((l, i) => ({
      id: `apercu-${i}`,
      sort_order: l.sort_order,
      chapter_no: l.chapter_no,
      page_no: l.page_no,
      kind: l.kind,
      prompt_fr: l.prompt_fr,
      prompt_en: l.prompt_en,
      prompt_he: l.prompt_he,
      options: l.options,
      answer_index: l.answer.index,
      explain_fr: l.explain_fr,
      explain_en: l.explain_en,
    }));
  }, [contenu, rapport, pages.data, slug, edition]);

  async function telecharger() {
    const { json } = await readExport({ data: { bookId, edition } });
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz-${slug}-${edition}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function publier() {
    if (!contenu) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await importer({ data: { bookId, edition, contenu } });
      setMessage(fmt(t("atelier.quiz.published"), { n: r.inserted }));
      setConfirm(false);
      refresh();
    } catch {
      setMessage(t("atelier.quiz.failed"));
    } finally {
      setBusy(false);
    }
  }

  const libelle = (p: QuizProbleme) =>
    p.code === "langueMismatch"
      ? t(`atelier.quiz.code.langueMismatch.${String(p.params["recu"])}` as DictKey)
      : fmt(t(`atelier.quiz.code.${p.code}` as DictKey), p.params);
  const erreurs = rapport?.erreurs ?? [];
  const ok = !!rapport && erreurs.length === 0;
  const total = stats.data?.total ?? 0;

  return (
    <div className="mt-6 grid gap-8 min-[800px]:grid-cols-2">
      {/* En ligne */}
      <section>
        <h2 className="text-[16px] font-medium">{t("atelier.quiz.online")}</h2>
        {stats.isLoading ? (
          <p className="mt-2 text-[13px]">{t("atelier.loading")}</p>
        ) : (
          <>
            <p className="mt-3">
              <span className="font-latin text-collection text-[40px] tabular-nums">{total}</span>{" "}
              <span className="text-[13px]">
                {fmt(t("atelier.quiz.questionsChapters"), {
                  n: stats.data?.chapitres.length ?? 0,
                })}
              </span>
            </p>
            {total === 0 ? <p className="text-[13px]">{t("atelier.quiz.empty")}</p> : null}
            <ul className="mt-3 space-y-3">
              {(stats.data?.chapitres ?? []).map((c) => {
                const low = c.tauxJuste != null && c.tauxJuste < 0.5;
                return (
                  <li key={c.chapitre} className="text-[13px]">
                    <div className="flex justify-between gap-3">
                      <span>
                        {c.chapitre}
                        {c.titre ? ` · ${c.titre}` : ""}
                      </span>
                      <span className="tabular-nums">
                        {fmt(t("atelier.quiz.lineQ"), { n: c.questions })} ·{" "}
                        {c.tauxJuste == null
                          ? t("atelier.quiz.noAnswers")
                          : fmt(t("atelier.quiz.pctRight"), { p: Math.round(c.tauxJuste * 100) })}
                      </span>
                    </div>
                    <div className="bg-ivory-2 mt-1 h-[3px]">
                      <div
                        className={low ? "bg-alert h-full" : "bg-collection h-full"}
                        style={{ width: `${(c.tauxJuste ?? 0) * 100}%` }}
                      />
                    </div>
                    {low && c.pireQuestion ? (
                      <p className="text-alert mt-1">
                        {fmt(t("atelier.quiz.worst"), { q: c.pireQuestion.texte })}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <button type="button" className={`${btn} mt-4`} onClick={() => void telecharger()}>
              {t("atelier.quiz.download")}
            </button>
          </>
        )}
      </section>

      {/* Nouveau fichier */}
      <section>
        <h2 className="text-[16px] font-medium">{t("atelier.quiz.newFile")}</h2>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void lireFichier(e.target.files?.[0])}
        />
        {nom ? (
          <div className="border-line mt-3 border p-3 text-[13px]">
            <p className="font-medium">{nom}</p>
            {rapport ? (
              <p>
                {fmt(t("atelier.quiz.fileInfo"), {
                  n: rapport.resume.total,
                  c: rapport.resume.parChapitre.map((c) => c.chapitre).join(", "),
                })}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-1 border-b border-current"
              onClick={() => fileRef.current?.click()}
            >
              {t("atelier.quiz.change")}
            </button>
          </div>
        ) : (
          <div
            className="border-line mt-3 border border-dashed p-6 text-center text-[13px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void lireFichier(e.dataTransfer.files?.[0]);
            }}
          >
            <p>{t("atelier.quiz.drop")}</p>
            <button
              type="button"
              className={`${btn} mt-2`}
              onClick={() => fileRef.current?.click()}
            >
              {t("atelier.quiz.choose")}
            </button>
          </div>
        )}
        <button
          type="button"
          className="mt-2 border-b border-current text-[13px]"
          onClick={() => setColler((v) => !v)}
        >
          {t("atelier.quiz.orPaste")}
        </button>
        {coller ? (
          <div className="mt-2">
            <textarea
              className="border-line h-40 w-full border p-2 font-mono text-[12px]"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onPaste={(e) => {
                const v = e.clipboardData.getData("text");
                if (v) {
                  e.preventDefault();
                  setTexte(v);
                  void lancer(v, null);
                }
              }}
            />
            <button type="button" className={btn} onClick={() => void lancer(texte, null)}>
              {t("atelier.quiz.analyzePaste")}
            </button>
          </div>
        ) : null}

        {busy ? <p className="mt-3 text-[13px]">{t("atelier.quiz.analyzing")}</p> : null}

        {rapport ? (
          <div className="mt-4 text-[13px]">
            {erreurs.length > 0 ? (
              <div className="bg-alert-soft text-alert border-alert border p-3">
                <span className="bg-alert text-ivory px-2 py-[1px] text-[11px]">
                  {fmt(t("atelier.quiz.errorsN"), { n: erreurs.length })}
                </span>{" "}
                {t("atelier.quiz.nothingChanged")}
              </div>
            ) : (
              <div className="border-line border p-3">
                {fmt(t("atelier.quiz.valid"), { n: rapport.resume.total })}
              </div>
            )}
            <ul className="mt-2">
              {[...erreurs, ...rapport.avertissements].map((p, i) => (
                <li key={i} className="border-line flex gap-3 border-b py-2">
                  <span className="w-24 shrink-0">
                    <span className={p.niveau === "erreur" ? "text-alert block" : "block"}>
                      {p.niveau === "erreur" ? t("atelier.quiz.error") : t("atelier.quiz.check")}
                    </span>
                    <span className="opacity-70">
                      {p.question != null
                        ? fmt(t("atelier.quiz.question"), { n: p.question })
                        : t("atelier.quiz.file")}
                    </span>
                  </span>
                  <span>{libelle(p)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {rapport || contenu ? (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btn}
                disabled={!ok || busy}
                onClick={() => setPreview((v) => !v)}
              >
                {preview ? t("atelier.quiz.closePreview") : t("atelier.quiz.try")}
              </button>
              <button
                type="button"
                className={btn}
                disabled={!ok || busy}
                onClick={() => setConfirm(true)}
              >
                {t("atelier.quiz.publish")}
              </button>
            </div>
            {!ok ? (
              <p className="mt-1 text-[12px] opacity-70">{t("atelier.quiz.buttonsHint")}</p>
            ) : null}
            {confirm && ok ? (
              <div className="border-line mt-3 border p-3">
                <p>{fmt(t(edition === "en" ? "atelier.quiz.confirmEn" : "atelier.quiz.confirmFr"), { x: total, y: rapport!.resume.total })}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className={btn}
                    disabled={busy}
                    onClick={() => void publier()}
                  >
                    {t("atelier.quiz.confirmYes")}
                  </button>
                  <button type="button" className={btn} onClick={() => setConfirm(false)}>
                    {t("atelier.quiz.cancel")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {message ? <p className="mt-3 text-[13px]">{message}</p> : null}

        {preview && apercu.length > 0 ? (
          <div className="border-line bg-background mt-4 border p-3" style={{ maxWidth: 390 }}>
            <QuizRound
              key={contenu}
              questions={apercu}
              mode={{ kind: "chapter", chapter: apercu[0]?.chapter_no ?? null }}
              chapterTitle={() => null}
              onExit={() => setPreview(false)}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
