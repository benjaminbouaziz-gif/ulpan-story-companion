import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { analyserQuiz, quizEdition, remplacerQuiz } from "@/lib/admin-editions.functions";
import { analyserQuizJson, messageQuiz, type PageRef } from "@/lib/quiz-json";
import type { QuizQuestion } from "@/lib/quiz-types";
import { QuizRound } from "@/components/QuizRound";
import { messageErreur } from "@/admin/textes";
import { btnCls, btnPrimaryCls, cellCls } from "@/admin/ui";

type Rapport = Awaited<ReturnType<typeof analyserQuiz>>;

/** Quiz d'UNE édition : ne lit et n'écrit que les questions de cette edition_id. */
export function EditionQuiz({ editionId, slug, lang, pages, onChanged }: {
  editionId: string;
  slug: string;
  lang: "fr" | "en";
  pages: PageRef[];
  onChanged: () => void;
}) {
  const readQuiz = useServerFn(quizEdition);
  const analyse = useServerFn(analyserQuiz);
  const remplacer = useServerFn(remplacerQuiz);
  const qc = useQueryClient();
  const key = ["admin", "quiz", editionId];
  const q = useQuery({ queryKey: key, queryFn: () => readQuiz({ data: { editionId } }) });

  const [contenu, setContenu] = useState("");
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [analyse_, setAnalyse_] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apercu, setApercu] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function lancer(src: string) {
    setContenu(src);
    setMsg(null);
    setApercu(false);
    // Pré-analyse locale, puis analyse serveur (aucune écriture).
    setBusy(true);
    try {
      setRapport(await analyse({ data: { editionId, contenu: src } }));
      setAnalyse_(src);
    } catch (e) {
      setRapport(null);
      setMsg(messageErreur(e));
    } finally {
      setBusy(false);
    }
  }

  const apercuQs: QuizQuestion[] = useMemo(() => {
    if (!analyse_ || !rapport || rapport.erreurs.length) return [];
    return analyserQuizJson(analyse_, slug, pages, lang).lignes.map((l, i) => ({ id: `apercu-${i}`, ...l }));
  }, [analyse_, rapport, slug, pages, lang]);

  function telecharger() {
    if (!q.data) return;
    const url = URL.createObjectURL(new Blob([q.data.json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz-${slug}-${lang}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = q.data?.total ?? 0;
  const ok = !!rapport && rapport.erreurs.length === 0 && analyse_ === contenu;

  async function ecrire() {
    const m = rapport?.resume.total ?? 0;
    if (!window.confirm(`Les ${total} questions actuelles seront remplacées par les ${m} questions du fichier.`)) return;
    setBusy(true);
    try {
      const r = await remplacer({ data: { editionId, contenu } });
      setMsg(`Quiz remplacé : ${r.inserted} questions.`);
      setRapport(null);
      setAnalyse_(null);
      await qc.invalidateQueries({ queryKey: key });
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error && e.message.includes("QUIZ_INVALID") ? "Le serveur a trouvé des erreurs : rien n'a été écrit." : messageErreur(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-[13px]">
      <p>
        <strong>{total}</strong> question(s) dans cette édition.
      </p>
      {q.data && q.data.chapitres.length > 0 && (
        <table className="mt-2 border-collapse">
          <thead>
            <tr><th className={cellCls}>Chapitre</th><th className={cellCls}>Questions</th><th className={cellCls}>Réponses</th><th className={cellCls}>Réussite</th></tr>
          </thead>
          <tbody>
            {q.data.chapitres.map((c) => (
              <tr key={c.chapitre}>
                <td className={cellCls}>{c.chapitre}</td>
                <td className={cellCls}>{c.questions}</td>
                <td className={cellCls}>{c.reponses}</td>
                <td className={cellCls}>{c.taux == null ? "—" : `${Math.round(c.taux * 100)} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {q.data?.pire && (
        <p className="mt-2">Question la plus ratée (chapitre {q.data.pire.chapitre}, {Math.round(q.data.pire.taux * 100)} % de réussite sur {q.data.pire.reponses}) : « {q.data.pire.question} »</p>
      )}
      <button type="button" className={`${btnCls} mt-3`} onClick={telecharger} disabled={!q.data}>Télécharger le quiz actuel (JSON)</button>

      <div className="mt-4">
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setContenu(await f.text());
          e.target.value = "";
        }} />
        <div
          className="border-line border border-dashed p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setContenu(await f.text()); }}
        >
          <p>Déposez un fichier JSON ici, <button type="button" className="underline" onClick={() => fileRef.current?.click()}>choisissez-le</button>, ou collez son contenu :</p>
          <textarea className="border-line mt-2 h-40 w-full border p-2 font-mono text-[12px]" value={contenu} onChange={(e) => setContenu(e.target.value)} />
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" className={btnCls} disabled={!contenu.trim() || busy} onClick={() => void lancer(contenu)}>Analyser</button>
          {ok && <button type="button" className={btnPrimaryCls} disabled={busy} onClick={() => void ecrire()}>Remplacer le quiz de cette édition</button>}
        </div>
        {msg && <p className="mt-2">{msg}</p>}
      </div>

      {rapport && (
        <div className="mt-3 space-y-2">
          {rapport.erreurs.length > 0 && (
            <div className="border-line border p-2">
              <p className="font-semibold">Erreurs ({rapport.erreurs.length}) — rien ne peut être écrit :</p>
              <ul className="list-disc pl-5">{rapport.erreurs.map((p, i) => <li key={i}>{messageQuiz(p)}</li>)}</ul>
            </div>
          )}
          {rapport.avertissements.length > 0 && (
            <div className="border-line border p-2">
              <p className="font-semibold">Avertissements ({rapport.avertissements.length}) :</p>
              <ul className="list-disc pl-5">{rapport.avertissements.map((p, i) => <li key={i}>{messageQuiz(p)}</li>)}</ul>
            </div>
          )}
          <p>
            {rapport.resume.total} question(s) — par chapitre : {rapport.resume.parChapitre.map((c) => `${c.chapitre} (${c.n})`).join(", ") || "—"} — par type : {rapport.resume.parType.map((t) => `${t.type} (${t.n})`).join(", ") || "—"}
          </p>
          {apercuQs.length > 0 && (
            <button type="button" className={btnCls} onClick={() => setApercu(!apercu)}>{apercu ? "Fermer l'aperçu" : "Aperçu jouable"}</button>
          )}
          {apercu && (
            <div className="border-line border p-3" style={{ width: 390 }}>
              <QuizRound
                key={analyse_ ?? ""}
                lang={lang}
                questions={apercuQs}
                mode={{ kind: "chapter", chapter: apercuQs[0]?.chapter_no ?? null }}
                chapterTitle={() => null}
                onExit={() => setApercu(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
