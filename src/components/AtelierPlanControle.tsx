import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useAtelierRefresh } from "@/lib/atelier-refresh";
import { MODES_CONTROLE, libelleModele } from "@/lib/atelier-models";
import {
  keepPlanV1,
  launchPlanControl,
  planControlState,
  savePlanText,
  type ControleRunRow,
} from "@/lib/plan-controle.functions";

/**
 * LE CONTRÔLE DU PLAN, DANS L'ÉTAPE PLAN.
 *
 * Aucune page nouvelle : le contrôle vit là où le plan vit. Le bouton n'apparaît
 * que si le contrôle est en marche dans les réglages ; sinon le plan v1 va
 * directement à la signature, exactement comme avant.
 *
 * Deux volets en mode A (plan éditable | rapport), trois en modes B et C
 * (plan v1 | rapport | plan v2). Sur mobile, des onglets.
 *
 * Ce panneau ne valide RIEN : la porte de validation reste celle du dossier
 * d'étape, juste en dessous.
 */

const boite = "border-line rounded-[2px] border p-3";
const mono = "font-mono w-full whitespace-pre-wrap break-words text-[12px] leading-[1.5]";

function duree(ms: number | null): string {
  return ms === null ? "—" : `${Math.round(ms / 1000)} s`;
}

function Pastille({ ok, nom }: { ok: boolean; nom: string }) {
  return (
    <span className="border-line inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 text-[12px]">
      <span
        aria-hidden
        className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-600" : "bg-destructive"}`}
      />
      {nom}
    </span>
  );
}

function Rapport({ run }: { run: ControleRunRow }) {
  const v = run.verdicts;
  const n = run.notes;
  if (run.status === "echoue")
    return (
      <div>
        <p className="text-[13px]">Le contrôle a échoué.</p>
        {run.error ? <p className="mt-1 text-[12px] opacity-80">{run.error}</p> : null}
      </div>
    );
  if (!v || !n || v.length === 0)
    return <p className="text-[13px]">Aucun rapport lisible pour cette exécution.</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {n.familles.map((f) => (
          <Pastille
            key={f.famille}
            ok={f.bloquantsEchoues === 0 && f.valides === f.total}
            nom={`${f.famille} ${f.note}%`}
          />
        ))}
      </div>
      <p className="mt-2 text-[13px]">
        {n.familles.map((f) => `${f.famille} ${f.note}% (${f.valides}/${f.total})`).join(" · ")} —{" "}
        <strong>moyenne {run.moyenne ?? n.moyenne}</strong>
      </p>
      <p className="mt-1 text-[12px] opacity-80">
        {n.valides}/{n.total} points valides · {n.bloquantsEchoues} bloquant(s) échoué(s) ·{" "}
        {run.attendus ?? 0} jugés par le modèle, {n.total - (run.attendus ?? 0)} mesurés par le code
      </p>

      <h4 className="mt-3 text-[13px] font-medium">Les {n.total} verdicts</h4>
      <ul className="mt-1 space-y-1">
        {v.map((x) => (
          <li key={x.code} className="border-line border-t pt-1 text-[12px]">
            <span
              aria-hidden
              className={`mr-2 inline-block h-2 w-2 rounded-full ${
                x.verdict === "valide" ? "bg-emerald-600" : "bg-destructive"
              }`}
            />
            <span className="font-mono">{x.code}</span>{" "}
            <span className="opacity-80">
              [{x.famille}
              {x.bloquant ? " · bloquant" : ""} · {x.source === "code" ? "mesuré" : "jugé"}]
            </span>{" "}
            {x.question}
            {x.explanation ? <span className="block opacity-80">{x.explanation}</span> : null}
            {x.location ? <span className="block opacity-80">Où : {x.location}</span> : null}
          </li>
        ))}
      </ul>

      <h4 className="mt-3 text-[13px] font-medium">
        Propositions ({run.propositions.length})
      </h4>
      {run.propositions.length === 0 ? (
        <p className="mt-1 text-[13px]">Aucun point échoué : rien à corriger.</p>
      ) : (
        <ul className="mt-1 space-y-2">
          {run.propositions.map((p) => (
            <li key={p.code} className="border-line border-t pt-2 text-[13px]">
              <p>
                <span className="font-mono font-medium">{p.code}</span>{" "}
                <span className="opacity-80">
                  [{p.famille}
                  {p.bloquant ? " · bloquant" : ""}]
                </span>{" "}
                {p.question}
              </p>
              {p.explanation ? <p className="mt-1">{p.explanation}</p> : null}
              {p.location ? <p className="mt-1 opacity-80">Où : {p.location}</p> : null}
              {p.proposition ? <p className="mt-1">Correction proposée : {p.proposition}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


export function PlanControlePanel({ bookStepId, onDone }: { bookStepId: string; onDone: () => void }) {
  const fetchState = useServerFn(planControlState);
  const launch = useServerFn(launchPlanControl);
  const keepV1 = useServerFn(keepPlanV1);
  const savePlan = useServerFn(savePlanText);
  const refreshAtelier = useAtelierRefresh();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"plan" | "rapport" | "planV2">("plan");
  const [edition, setEdition] = useState<string | null>(null);

  const state = useQuery({
    queryKey: ["atelier", "controlePlan", bookStepId],
    queryFn: () => fetchState({ data: { bookStepId } }),
    refetchInterval: (q) => (q.state.data?.running ? 5000 : false),
    refetchIntervalInBackground: false,
  });
  const s = state.data;

  const run = useMutation({
    mutationFn: () => launch({ data: { bookStepId } }),
    onMutate: () => {
      setError(null);
      setNotice(null);
    },
    onSuccess: (res) => {
      setNotice(
        `Contrôle terminé (mode ${res.mode}) — moyenne ${res.moyenne ?? "—"}, ${res.propositions} proposition(s)${
          res.planV2Version ? `, plan corrigé v${res.planV2Version}` : ""
        }.`,
      );
    },
    onError: (e: Error) => setError(e.message),
    onSettled: async () => {
      await state.refetch();
      refreshAtelier();
      onDone();
    },
  });

  const garder = useMutation({
    mutationFn: () => keepV1({ data: { bookStepId } }),
    onSuccess: async (res) => {
      setNotice(`Le plan d'avant la correction redevient le plan courant (v${res.version}).`);
      await state.refetch();
      refreshAtelier();
      onDone();
    },
    onError: (e: Error) => setError(e.message),
  });

  const enregistrer = useMutation({
    mutationFn: (texte: string) => savePlan({ data: { bookStepId, texte } }),
    onSuccess: async (res) => {
      setEdition(null);
      setNotice(`Plan corrigé à la main déposé en version ${res.version}.`);
      await state.refetch();
      refreshAtelier();
      onDone();
    },
    onError: (e: Error) => setError(e.message),
  });

  // Pendant l'exécution, l'écran suit tout seul.
  const running = (s?.running ?? false) || run.isPending;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void state.refetch(), 5000);
    return () => clearInterval(id);
  }, [running, state]);

  if (!s || !s.isPlanStep) return null;

  const dernier = s.runs[0] ?? null;
  const troisVolets = s.mode !== "A";
  const modeInfo = MODES_CONTROLE.find((m) => m.code === s.mode);

  if (!s.enabled)
    return (
      <div className="border-line mt-5 border-t pt-4 text-[13px]">
        <h2 className="font-latin text-[16px]">Contrôle du plan</h2>
        <p className="mt-1 opacity-80">
          Le contrôle est arrêté dans les réglages de l'atelier : le plan va directement à votre
          signature.
        </p>
      </div>
    );

  const voletPlan = (
    <div className={boite}>
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium">
          Plan {s.planVersion !== null ? `v${s.planVersion}` : ""}
        </h3>
        {!troisVolets ? (
          edition === null ? (
            <button
              type="button"
              className="border-b border-current text-[12px]"
              onClick={() => setEdition(s.planTexte ?? "")}
            >
              corriger à la main
            </button>
          ) : (
            <span className="flex gap-3 text-[12px]">
              <button
                type="button"
                className="border-b border-current"
                disabled={enregistrer.isPending}
                onClick={() => {
                  if (!edition.trim()) return;
                  enregistrer.mutate(edition);
                }}
              >
                {enregistrer.isPending ? "…" : "déposer cette version"}
              </button>
              <button type="button" className="border-b border-current" onClick={() => setEdition(null)}>
                annuler
              </button>
            </span>
          )
        ) : null}
      </div>
      {edition === null ? (
        <pre className={`${mono} mt-2 max-h-[420px] overflow-auto`}>{s.planTexte ?? "—"}</pre>
      ) : (
        <textarea
          value={edition}
          onChange={(e) => setEdition(e.target.value)}
          rows={20}
          className={`border-line ${mono} mt-2 w-full rounded-[2px] border bg-transparent p-2`}
        />
      )}
    </div>
  );

  const voletRapport = (
    <div className={boite}>
      <h3 className="text-[13px] font-medium">Rapport de contrôle</h3>
      <div className="mt-2">
        {dernier ? <Rapport run={dernier} /> : <p className="text-[13px]">Aucun contrôle lancé pour l'instant.</p>}
      </div>
      {s.reponseBrute ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px]">
            La réponse brute du modèle ({s.reponseBrute.length} caractères)
          </summary>
          <pre className={`${mono} mt-2 max-h-[320px] overflow-auto`}>{s.reponseBrute}</pre>
        </details>
      ) : null}

    </div>
  );

  const voletPlanV2 = (
    <div className={boite}>
      <h3 className="text-[13px] font-medium">Plan corrigé</h3>
      <pre className={`${mono} mt-2 max-h-[420px] overflow-auto`}>{s.planV2Texte ?? "—"}</pre>
    </div>
  );

  return (
    <div className="border-line mt-5 border-t pt-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-latin text-[16px]">Contrôle du plan</h2>
        <span className="border-line rounded-[2px] border px-2 py-0.5 text-[12px]">
          {modeInfo?.label ?? s.mode}
        </span>
      </div>
      <p className="mt-1 text-[13px] opacity-80">{modeInfo?.desc}</p>

      {s.manques.length > 0 ? (
        <div className="mt-2 text-[13px]">
          <p>Le contrôle ne peut pas partir :</p>
          <ul className="mt-1 list-disc pl-5">
            {s.manques.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!s.hasPlan ? (
        <p className="mt-2 text-[13px]">Aucun plan déposé : lancez d'abord le robot du plan.</p>
      ) : null}

      {running ? (
        <p className="mt-2 text-[13px]">
          {s.runningPhase === "correction" ? "Correction en cours…" : "Contrôle en cours…"}
        </p>
      ) : null}
      {notice ? <p className="mt-2 text-[13px]">{notice}</p> : null}
      {error ? <p className="mt-2 text-[13px]">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={running || s.manques.length > 0 || !s.hasPlan}
          onClick={() => run.mutate()}
        >
          {dernier ? "Relancer le contrôle" : "Lancer le contrôle"}
        </Button>
        {troisVolets && s.planV2Texte ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={garder.isPending || running}
            onClick={() => {
              if (window.confirm("Garder le plan d'avant la correction ? Il redevient le plan courant ; rien n'est supprimé."))
                garder.mutate();
            }}
          >
            Garder le plan v1
          </Button>
        ) : null}
      </div>

      {/* Les volets : côte à côte sur grand écran, en onglets sur téléphone. */}
      <div className="mt-4">
        <div className="flex gap-3 text-[12px] md:hidden">
          <button
            type="button"
            className={onglet === "plan" ? "border-b border-current" : "opacity-70"}
            onClick={() => setOnglet("plan")}
          >
            Plan
          </button>
          <button
            type="button"
            className={onglet === "rapport" ? "border-b border-current" : "opacity-70"}
            onClick={() => setOnglet("rapport")}
          >
            Rapport
          </button>
          {troisVolets ? (
            <button
              type="button"
              className={onglet === "planV2" ? "border-b border-current" : "opacity-70"}
              onClick={() => setOnglet("planV2")}
            >
              Plan corrigé
            </button>
          ) : null}
        </div>

        <div className="mt-2 md:hidden">
          {onglet === "plan" ? voletPlan : onglet === "rapport" ? voletRapport : voletPlanV2}
        </div>

        <div className={`mt-2 hidden gap-3 md:grid ${troisVolets ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {voletPlan}
          {voletRapport}
          {troisVolets ? voletPlanV2 : null}
        </div>
      </div>

      {/* L'historique des contrôles de cette étape : jamais tronqué. */}
      {s.runs.length > 1 ? (
        <div className="mt-4 text-[12px]">
          <h3 className="text-[13px] font-medium">Contrôles précédents</h3>
          <ul className="mt-1 space-y-1">
            {s.runs.slice(1).map((r) => (
              <li key={r.id} className="border-line border-t pt-1">
                {new Date(r.createdAt).toLocaleString("fr-FR")} · mode {r.mode} · {r.status} · moyenne{" "}
                {r.moyenne ?? "—"} · {duree(r.durationMs)} · contrôleur {r.controleurModelUsed ?? "—"}
                {r.redacteurModelUsed ? ` · rédacteur ${r.redacteurModelUsed}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-[12px] opacity-70">
        Modèles effectifs : contrôleur {libelleModele(dernier?.controleurModelUsed ?? null)}
        {troisVolets ? ` · rédacteur ${libelleModele(dernier?.redacteurModelUsed ?? null)}` : ""}. Rien ne
        passe à l'étape suivante sans votre signature, juste en dessous.
      </p>
    </div>
  );
}
