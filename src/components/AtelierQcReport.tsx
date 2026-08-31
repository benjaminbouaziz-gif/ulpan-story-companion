import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAtelierRefresh } from "@/lib/atelier-refresh";
import {
  qcForceValidate,
  qcSendToCorrection,
  qcStepDossier,
  runQcControl,
  type QcReportRow,
} from "@/lib/qc.functions";

/**
 * BRIQUE 9 — LE CONTRÔLE QUALITÉ DANS LE DOSSIER D'ÉTAPE.
 *
 * Ordre de lecture imposé : la LIGNE DE VERDICT d'abord (passé ou non, la note,
 * le nombre de bloquants, le tour où ça s'est arrêté et pourquoi), puis le
 * rapport REPLIÉ. Ouvert, le rapport COMMENCE PAR LES ÉCHECS : bloquants
 * d'abord, puis les autres, puis les critères validés. Les tours précédents
 * sont repliés dessous.
 *
 * Aucune note n'est demandée à un modèle : tout ce qui est affiché ici est
 * calculé par le serveur à partir de verdicts binaires.
 */

const cell = "border-line border-b px-2 py-1 text-left align-top";

function duree(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`;
}

function note(n: number | null): string {
  return n === null ? "—" : `${n} %`;
}

function ligneVerdict(r: QcReportRow): string {
  const bloquants =
    r.blockingFailed > 0
      ? ` · ${r.blockingFailed} critère${r.blockingFailed > 1 ? "s" : ""} bloquant${r.blockingFailed > 1 ? "s" : ""} échoué${r.blockingFailed > 1 ? "s" : ""}`
      : " · aucun critère bloquant échoué";
  return `${r.statusLabel} · note générale ${note(r.scoreGeneral)} · ${r.criteriaPassed} critère(s) validé(s) sur ${r.criteriaTotal}${bloquants} · arrêté au tour ${r.round}`;
}

function TableauVerdicts({ rapport }: { rapport: QcReportRow }) {
  return (
    <table className="mt-2 w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th className={cell}>Verdict</th>
          <th className={cell}>Critère</th>
          <th className={cell}>Famille</th>
          <th className={cell}>Espèce</th>
          <th className={cell}>Localisation</th>
          <th className={cell}>Explication</th>
        </tr>
      </thead>
      <tbody>
        {rapport.verdicts.map((v) => (
          <tr key={v.id}>
            <td className={cell}>
              {v.verdict === "echoue" ? (v.isBlocking ? "échoué, bloquant" : "échoué") : "validé"}
            </td>
            <td className={cell}>{v.label}</td>
            <td className={cell}>{v.familyLabel}</td>
            <td className={cell}>{v.species === "mecanique" ? "mécanique" : "jugé"}</td>
            <td className={cell}>{v.location ?? "—"}</td>
            <td className={cell}>{v.explanation ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StepQcPanel({ bookStepId }: { bookStepId: string }) {
  const invalidate = useAtelierRefresh();
  const fetchDossier = useServerFn(qcStepDossier);
  const run = useServerFn(runQcControl);
  const correct = useServerFn(qcSendToCorrection);
  const force = useServerFn(qcForceValidate);

  const [ouvert, setOuvert] = useState(false);
  const [tours, setTours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dossier = useQuery({
    queryKey: ["atelier", "qc", "dossier", bookStepId],
    queryFn: () => fetchDossier({ data: { bookStepId } }),
  });

  const lancer = useMutation({
    mutationFn: () => run({ data: { bookStepId } }),
    onSuccess: (r) => {
      setMessage(r.message);
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const renvoyer = useMutation({
    mutationFn: (reportId: string) => correct({ data: { reportId } }),
    onSuccess: (r) => {
      setMessage(r.message);
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const forcer = useMutation({
    mutationFn: (args: { reportId: string; comment: string }) => force({ data: args }),
    onSuccess: () => {
      setMessage("Validation forcée : la décision est inscrite sur le rapport.");
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const d = dossier.data;
  if (!d || !d.hasController) return null;

  const rapports = d.reports;
  const dernier = rapports[0] ?? null;
  const precedents = rapports.slice(1);

  return (
    <div className="border-line mt-6 border-t pt-4 text-[13px]">
      <h2 className="font-latin text-[16px]">Contrôle qualité</h2>
      <p className="mt-1 opacity-70">
        Interrupteur global : {d.enabled ? "en marche" : "à l'arrêt"} · stratégie de cette étape :{" "}
        {d.strategyLabel} · plafond {d.maxRounds} tour(s) · seuil {d.passThreshold} % de critères validés.
      </p>

      {/* LA LIGNE DE VERDICT, en tête, avant tout le reste. */}
      {dernier ? (
        <p className="mt-3">{ligneVerdict(dernier)}</p>
      ) : (
        <p className="mt-3">Aucun contrôle n'a encore été rendu sur cette étape.</p>
      )}
      {dernier?.message ? <p className="mt-1 opacity-70">{dernier.message}</p> : null}

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          className="border-line border px-2 py-0.5"
          disabled={lancer.isPending}
          onClick={() => lancer.mutate()}
        >
          {lancer.isPending ? "Contrôle en cours…" : dernier ? "Relancer le contrôle" : "Contrôler maintenant"}
        </button>
        {dernier && !dernier.passed ? (
          <>
            <button
              type="button"
              className="border-line border px-2 py-0.5"
              disabled={renvoyer.isPending}
              onClick={() => {
                if (window.confirm("Renvoyer en correction à partir de ce rapport ? Seuls les chapitres visés seront réécrits."))
                  renvoyer.mutate(dernier.id);
              }}
            >
              {renvoyer.isPending ? "Correction en cours…" : "Renvoyer en correction"}
            </button>
            <button
              type="button"
              className="border-line border px-2 py-0.5"
              disabled={forcer.isPending}
              onClick={() => {
                const motif = window.prompt(
                  "Forcer la validation malgré le rapport. Motif (il sera inscrit sur le rapport) :",
                );
                if (motif && motif.trim()) forcer.mutate({ reportId: dernier.id, comment: motif.trim() });
              }}
            >
              Forcer la validation
            </button>
          </>
        ) : null}
      </div>

      {/* LE RAPPORT, REPLIÉ. */}
      {dernier ? (
        <div className="mt-4">
          <button type="button" className="border-b border-current" onClick={() => setOuvert((v) => !v)}>
            {ouvert ? "Replier le rapport" : "Ouvrir le rapport"} (tour {dernier.round} ·{" "}
            {dernier.verdicts.filter((v) => v.verdict === "echoue").length} échec(s))
          </button>
          {ouvert ? (
            <>
              <table className="mt-3 w-full border-collapse text-[13px]">
                <tbody>
                  {dernier.scores.map((s) => (
                    <tr key={s.family}>
                      <td className={cell}>{s.label}</td>
                      <td className={cell}>{note(s.score)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className={cell}>Moyenne générale (thermomètre, ne valide rien)</td>
                    <td className={cell}>{note(dernier.scoreGeneral)}</td>
                  </tr>
                  <tr>
                    <td className={cell}>Modèle du contrôleur · durée</td>
                    <td className={cell}>
                      {dernier.modelUsed ?? "—"} · {duree(dernier.durationMs)}
                    </td>
                  </tr>
                  {dernier.planVersion !== null ? (
                    <tr>
                      <td className={cell}>Plan qui a servi à juger</td>
                      <td className={cell}>version {dernier.planVersion}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              <TableauVerdicts rapport={dernier} />
            </>
          ) : null}
        </div>
      ) : null}

      {/* LES TOURS PRÉCÉDENTS, REPLIÉS DESSOUS. */}
      {precedents.length > 0 ? (
        <div className="mt-4">
          <button type="button" className="border-b border-current" onClick={() => setTours((v) => !v)}>
            {tours ? "Replier les tours précédents" : "Voir les tours précédents"} ({precedents.length})
          </button>
          {tours ? (
            <div className="mt-2 space-y-4">
              {precedents.map((r) => (
                <div key={r.id}>
                  <p>
                    Tour {r.round}
                    {r.chapterNo ? ` · chapitre ${r.chapterNo}` : ""} · {ligneVerdict(r)}
                  </p>
                  <TableauVerdicts rapport={r} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="mt-3">{message}</p> : null}
    </div>
  );
}
