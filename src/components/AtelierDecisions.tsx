import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import {
  addDecision,
  bookDecisions,
  deleteDecision,
  saveDecision,
  stepDecisions,
  type DecisionRow,
} from "@/lib/atelier-decisions.functions";

/**
 * BRIQUE 7 — LA SAISIE DES DÉCISIONS.
 *
 * Aucune limite de nombre, aucune troncature, aucune petite fenêtre qui défile :
 * le bloc grandit. Les zones de texte démarrent à deux lignes et grandissent
 * d'elles-mêmes. Les boutons restent toujours cliquables et disent en clair ce
 * qui manque. Rien n'est annoncé comme réussi sans réponse du serveur.
 */

const cell = "border-line border-b px-2 py-1 text-left align-top";

/** Une zone de texte qui suit ce qu'on écrit : deux lignes, puis autant qu'il faut. */
function GrowingTextarea(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      rows={2}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      className={`border-line w-full resize-none overflow-hidden border bg-transparent px-1 py-0.5 ${props.className ?? ""}`}
    />
  );
}

const STATUSES: DecisionRow["status"][] = ["ouverte", "tranchee", "ecartee"];

function DecisionLine({ row, onDone }: { row: DecisionRow; onDone: () => void }) {
  const { t } = useI18n();
  const save = useServerFn(saveDecision);
  const remove = useServerFn(deleteDecision);
  const [question, setQuestion] = useState(row.question);
  const [decision, setDecision] = useState(row.decision ?? "");
  const [status, setStatus] = useState<DecisionRow["status"]>(row.status);
  const [openContext, setOpenContext] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Une relance du robot peut réécrire la ligne : l'écran suit la base.
  useEffect(() => {
    setQuestion(row.question);
    setDecision(row.decision ?? "");
    setStatus(row.status);
  }, [row.id, row.question, row.decision, row.status]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: row.id,
          question,
          status,
          ...(row.contexte ? { contexte: row.contexte } : {}),
          ...(decision.trim() ? { decision: decision.trim() } : {}),
        },
      }),
    onSuccess: () => {
      setMessage(t("atelier.dec.saved"));
      onDone();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const suppression = useMutation({
    mutationFn: () => remove({ data: { id: row.id } }),
    onSuccess: onDone,
    onError: (e: Error) => setMessage(e.message),
  });

  return (
    <div className="border-line mt-4 border-t pt-3">
      <GrowingTextarea value={question} onChange={setQuestion} placeholder={t("atelier.dec.question")} />

      {row.stale ? <p className="mt-1 opacity-70">{t("atelier.dec.stale")}</p> : null}

      {row.contexte ? (
        <div className="mt-1">
          <button
            type="button"
            className="border-b border-current"
            onClick={() => setOpenContext((v) => !v)}
          >
            {openContext ? t("atelier.dec.hideContext") : t("atelier.dec.showContext")}
          </button>
          {openContext ? <p className="mt-1 whitespace-pre-wrap opacity-80">{row.contexte}</p> : null}
        </div>
      ) : null}

      <div className="mt-2">
        <GrowingTextarea value={decision} onChange={setDecision} placeholder={t("atelier.dec.myDecision")} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label>
          {t("atelier.dec.status")}{" "}
          <select
            className="border-line border bg-transparent px-1 py-0.5"
            value={status}
            onChange={(e) => setStatus(e.target.value as DecisionRow["status"])}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`atelier.dec.status.${s}` as DictKey)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="border-line border px-2 py-0.5"
          onClick={() => {
            if (question.trim().length === 0) {
              setMessage(t("atelier.dec.questionMissing"));
              return;
            }
            setMessage(null);
            mutation.mutate();
          }}
        >
          {mutation.isPending ? t("atelier.dec.saving") : t("atelier.dec.save")}
        </button>
        <button
          type="button"
          className="border-line border px-2 py-0.5"
          onClick={() => {
            if (window.confirm(`${t("atelier.dec.confirmDelete")} « ${row.question} »`))
              suppression.mutate();
          }}
        >
          {t("atelier.dec.delete")}
        </button>
      </div>
      {message ? <p className="mt-1">{message}</p> : null}
    </div>
  );
}

/** Le bloc « Décisions à prendre », sous le livrable courant. */
export function StepDecisions({ bookStepId }: { bookStepId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchAll = useServerFn(stepDecisions);
  const add = useServerFn(addDecision);
  const [newQuestion, setNewQuestion] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["atelier", "decisions", bookStepId],
    queryFn: () => fetchAll({ data: { bookStepId } }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["atelier", "decisions"] });
    void qc.invalidateQueries({ queryKey: ["atelier", "dossier", bookStepId] });
  };

  const creation = useMutation({
    mutationFn: () => add({ data: { bookStepId, question: newQuestion.trim() } }),
    onSuccess: () => {
      setNewQuestion("");
      setAdding(false);
      setMessage(null);
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const toutes = q.data?.decisions ?? [];
  // Une décision archivée sort de ma vue : elle ne compte pas, elle attend en bas.
  const rows = toutes.filter((r) => r.archivedAt === null);
  const archivees = toutes.filter((r) => r.archivedAt !== null);
  const vives = rows.filter((r) => !r.stale);
  const perimees = rows.filter((r) => r.stale);
  const tranchees = rows.filter((r) => r.status !== "ouverte").length;

  return (
    <div className="mt-6">
      <h2 className="font-latin text-[16px]">{t("atelier.dec.title")}</h2>

      {q.data?.parseFailed ? <p className="mt-1">{t("atelier.dec.parseFailed")}</p> : null}

      {q.isLoading ? (
        <p className="mt-1">…</p>
      ) : rows.length === 0 ? (
        <p className="mt-1">{t("atelier.dec.none")}</p>
      ) : (
        <p className="mt-1">
          {tranchees} {t("atelier.dec.counterOf")} {rows.length}
        </p>
      )}

      {[...vives, ...perimees].map((row) => (
        <DecisionLine key={row.id} row={row} onDone={invalidate} />
      ))}

      <ArchivedDecisions rows={archivees} />


      <div className="mt-4">
        {adding ? (
          <div>
            <GrowingTextarea
              value={newQuestion}
              onChange={setNewQuestion}
              placeholder={t("atelier.dec.question")}
            />
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                className="border-line border px-2 py-0.5"
                onClick={() => {
                  if (newQuestion.trim().length === 0) {
                    setMessage(t("atelier.dec.questionMissing"));
                    return;
                  }
                  setMessage(null);
                  creation.mutate();
                }}
              >
                {creation.isPending ? t("atelier.dec.saving") : t("atelier.dec.save")}
              </button>
              <button
                type="button"
                className="border-line border px-2 py-0.5"
                onClick={() => {
                  setAdding(false);
                  setMessage(null);
                }}
              >
                {t("atelier.dec.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="border-line border px-2 py-0.5"
            onClick={() => setAdding(true)}
          >
            {t("atelier.dec.add")}
          </button>
        )}
        {message ? <p className="mt-1">{message}</p> : null}
      </div>
    </div>
  );
}

/** La mémoire des arbitrages, sur la page du livre, sous la chaîne. */
export function BookDecisions({ bookId }: { bookId: string }) {
  const { t } = useI18n();
  const fetchAll = useServerFn(bookDecisions);
  const q = useQuery({
    queryKey: ["atelier", "decisions", "book", bookId],
    queryFn: () => fetchAll({ data: { bookId } }),
  });
  const rows = q.data ?? [];

  return (
    <div className="mt-8 text-[13px]">
      <h2 className="font-latin text-[16px]">{t("atelier.dec.bookTitle")}</h2>
      {q.isLoading ? (
        <p className="mt-2">…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2">{t("atelier.dec.none")}</p>
      ) : (
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <th className={cell}>{t("atelier.books.col.step")}</th>
              <th className={cell}>{t("atelier.dec.question")}</th>
              <th className={cell}>{t("atelier.dec.myDecision")}</th>
              <th className={cell}>{t("atelier.dec.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cell}>{r.stepLabelFr ?? t("atelier.none")}</td>
                <td className={cell}>
                  {r.question}
                  {r.stale ? <span className="block opacity-70">{t("atelier.dec.stale")}</span> : null}
                </td>
                <td className={cell}>{r.decision ?? "—"}</td>
                <td className={cell}>{t(`atelier.dec.status.${r.status}` as DictKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
