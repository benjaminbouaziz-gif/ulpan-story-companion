import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useAtelierRefresh } from "@/lib/atelier-refresh";
import { qcBookPolicies, setQcStepPolicy, type QcStepPolicyRow } from "@/lib/qc.functions";

/**
 * BRIQUE 9 — LA STRATÉGIE DE CONTRÔLE, ÉTAPE PAR ÉTAPE.
 *
 * Le contrôle n'est pas une étape de la chaîne : c'est une propriété de l'étape
 * qu'il contrôle, réglable à tout moment depuis la page du livre. Changer la
 * stratégie n'affecte jamais un lancement en cours : la stratégie est lue au
 * début d'un contrôle, jamais pendant.
 *
 * On lit aussi ici les quatre notes de famille et la moyenne : la note du
 * PREMIER tour et celle du DERNIER. Pas de courbe, pas de graphique.
 */

const cell = "border-line border-b px-2 py-1 text-left align-top";

function note(n: number | null): string {
  return n === null ? "—" : `${n} %`;
}

function Ligne({
  step,
  grids,
  onSave,
  busy,
}: {
  step: QcStepPolicyRow;
  grids: { id: string; name: string }[];
  onSave: (v: { bookStepId: string; strategy: QcStepPolicyRow["strategy"]; maxRounds: number; passThreshold: number; gridId: string | null }) => void;
  busy: boolean;
}) {
  const [strategy, setStrategy] = useState(step.strategy);
  const [maxRounds, setMaxRounds] = useState(step.maxRounds);
  const [threshold, setThreshold] = useState(step.passThreshold);
  const [gridId, setGridId] = useState(step.gridId ?? "");

  const change =
    strategy !== step.strategy ||
    maxRounds !== step.maxRounds ||
    threshold !== step.passThreshold ||
    (gridId || null) !== step.gridId;

  return (
    <tr>
      <td className={cell}>
        {step.rank} · {step.labelFr}
        {!step.hasController ? <span className="block opacity-70">aucun contrôleur pour cette étape</span> : null}
      </td>
      <td className={cell}>
        <select
          className="border-line border bg-transparent px-1 py-0.5"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as QcStepPolicyRow["strategy"])}
        >
          <option value="aucun">aucun contrôle</option>
          <option value="une_fois">juger et corriger une fois</option>
          <option value="boucle">boucle</option>
        </select>
      </td>
      <td className={cell}>
        <input
          type="number"
          min={1}
          max={10}
          className="border-line w-[60px] border bg-transparent px-1 py-0.5"
          value={maxRounds}
          onChange={(e) => setMaxRounds(Number(e.target.value))}
        />
      </td>
      <td className={cell}>
        <input
          type="number"
          min={0}
          max={100}
          className="border-line w-[70px] border bg-transparent px-1 py-0.5"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
      </td>
      <td className={cell}>
        <select
          className="border-line border bg-transparent px-1 py-0.5"
          value={gridId}
          onChange={(e) => setGridId(e.target.value)}
        >
          <option value="">grille par défaut de l'étape</option>
          {grids.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </td>
      <td className={cell}>
        <button
          type="button"
          className="border-line border px-2 py-0.5"
          disabled={!change || busy}
          onClick={() =>
            onSave({
              bookStepId: step.stepId,
              strategy,
              maxRounds,
              passThreshold: threshold,
              gridId: gridId || null,
            })
          }
        >
          Enregistrer
        </button>
      </td>
    </tr>
  );
}

export function BookQcPolicies({ bookId }: { bookId: string }) {
  const invalidate = useAtelierRefresh();
  const fetchPolicies = useServerFn(qcBookPolicies);
  const save = useServerFn(setQcStepPolicy);
  const [message, setMessage] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["atelier", "qc", "policies", bookId],
    queryFn: () => fetchPolicies({ data: { bookId } }),
  });

  const enregistrer = useMutation({
    mutationFn: (v: Parameters<Parameters<typeof Ligne>[0]["onSave"]>[0]) => save({ data: v }),
    onSuccess: () => {
      setMessage("Stratégie enregistrée. Un lancement déjà en cours garde la stratégie sous laquelle il a démarré.");
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const d = q.data;

  return (
    <div className="border-line mt-8 border-t pt-4 text-[13px]" id="controle-qualite">
      <h2 className="font-latin text-[16px]">Contrôle qualité de ce livre</h2>
      <p className="mt-1 opacity-70">
        Interrupteur global : {d ? (d.enabled ? "en marche" : "à l'arrêt") : "…"}. Il se règle dans la salle{" "}
        <Link to="/atelier/qualite" className="border-b border-current">
          Qualité
        </Link>
        .
      </p>

      {!d ? (
        <p className="mt-3">…</p>
      ) : d.steps.length === 0 ? (
        <p className="mt-3">Ce livre ne porte aucune étape intelligente : rien à contrôler.</p>
      ) : (
        <>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr>
                <th className={cell}>Étape</th>
                <th className={cell}>Stratégie</th>
                <th className={cell}>Plafond de tours</th>
                <th className={cell}>Seuil (%)</th>
                <th className={cell}>Grille</th>
                <th className={cell} />
              </tr>
            </thead>
            <tbody>
              {d.steps.map((s) => (
                <Ligne
                  key={s.stepId}
                  step={s}
                  grids={d.grids}
                  busy={enregistrer.isPending}
                  onSave={(v) => enregistrer.mutate(v)}
                />
              ))}
            </tbody>
          </table>

          <h3 className="font-latin mt-6 text-[15px]">Les notes</h3>
          {d.steps.every((s) => !s.lastReport) ? (
            <p className="mt-2">Aucun contrôle n'a encore été rendu sur ce livre.</p>
          ) : (
            <table className="mt-2 w-full border-collapse">
              <thead>
                <tr>
                  <th className={cell}>Étape</th>
                  <th className={cell}>Conformité fiche</th>
                  <th className={cell}>Structure</th>
                  <th className={cell}>Pédagogie</th>
                  <th className={cell}>Langue</th>
                  <th className={cell}>Moyenne, premier tour</th>
                  <th className={cell}>Moyenne, dernier tour</th>
                  <th className={cell}>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {d.steps
                  .filter((s) => s.lastReport)
                  .map((s) => (
                    <tr key={s.stepId}>
                      <td className={cell}>
                        <Link to="/atelier/etape/$id" params={{ id: s.stepId }} className="border-b border-current">
                          {s.labelFr}
                        </Link>
                      </td>
                      {(s.lastReport?.scores ?? []).map((f) => (
                        <td key={f.family} className={cell}>
                          {note(f.score)}
                        </td>
                      ))}
                      <td className={cell}>{note(s.firstReport?.scoreGeneral ?? null)}</td>
                      <td className={cell}>{note(s.lastReport?.scoreGeneral ?? null)}</td>
                      <td className={cell}>
                        {s.lastReport?.statusLabel}
                        {s.lastReport && s.lastReport.blockingFailed > 0
                          ? ` · ${s.lastReport.blockingFailed} bloquant(s)`
                          : ""}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {message ? <p className="mt-3">{message}</p> : null}
    </div>
  );
}
