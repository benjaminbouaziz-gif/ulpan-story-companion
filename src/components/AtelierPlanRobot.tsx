import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/context";
import { cancelPlanRun, launchPlanRobot, planRobotState } from "@/lib/atelier-robot.functions";

/**
 * LE ROBOT DE L'ÉTAPE « PLAN DE CHAPITRES ».
 *
 * Un seul bouton, et au-dessus de lui la vérité : quel prompt, quelle version,
 * quel modèle, avec ou sans recherche en ligne. Quand quelque chose manque, le
 * bouton reste éteint et la raison est écrite en clair — jamais « erreur ».
 * Pendant qu'un lancement tourne, l'écran le dit et s'interroge tout seul
 * toutes les 5 secondes, puis s'arrête dès que c'est fini.
 * Rien de ce qui part au modèle n'est montré ni conservé : seul le plan déposé
 * compte.
 */
export function PlanRobotPanel({
  bookStepId,
  onDone,
}: {
  bookStepId: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const fetchState = useServerFn(planRobotState);
  const launch = useServerFn(launchPlanRobot);
  const cancel = useServerFn(cancelPlanRun);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const state = useQuery({
    queryKey: ["atelier", "robotPlan", bookStepId],
    queryFn: () => fetchState({ data: { bookStepId } }),
    // Tant que ça tourne, on regarde toutes les 5 s ; sinon, on cesse.
    refetchInterval: (q) => (q.state.data?.running ? 5000 : false),
    refetchIntervalInBackground: false,
  });

  const s = state.data;
  const running = s?.running ?? false;

  const run = useMutation({
    mutationFn: (mode: "avec_precedent" | "sans_precedent" | null) =>
      launch({
        data: {
          bookStepId,
          withReason: mode === "avec_precedent",
          ...(mode ? { mode } : {}),
        },
      }),
    onSuccess: async () => {
      setError(null);
      setNotice(null);
      await state.refetch();
      onDone();
    },
    onError: async (e: Error) => {
      setError(e.message);
      await state.refetch();
      onDone();
    },
  });

  const stop = useMutation({
    mutationFn: () => cancel({ data: { bookStepId } }),
    onSuccess: async () => {
      setError(null);
      setNotice(t("atelier.robot.stopped"));
      await state.refetch();
      onDone();
    },
    onError: (e: Error) => setError(e.message),
  });

  // Dès que le lancement cesse, le dossier se rafraîchit sans rechargement.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) onDone();
    wasRunning.current = running;
  }, [running, onDone]);

  if (!s || !s.isPlanStep) return null;

  const relaunch = s.hasPrevious && s.lastReason !== null;
  const blocked = s.missing.length > 0 || run.isPending;

  const ago = (iso: string): string => {
    const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    return sec < 60
      ? t("atelier.robot.agoSec").replace("{n}", String(sec))
      : t("atelier.robot.agoMin").replace("{n}", String(Math.round(sec / 60)));
  };

  return (
    <div className="border-line mt-5 border-t pt-4">
      <h2 className="font-latin text-[16px]">{t("atelier.robot.title")}</h2>
      <p className="mt-1">
        {t("atelier.robot.prompt")} : {s.promptName ?? t("atelier.none")}
        {s.promptVersion !== null ? ` — ${t("atelier.prompts.version")} ${s.promptVersion}` : ""}
      </p>
      <p>
        {t("atelier.robot.model")} : {s.model ?? t("atelier.none")} —{" "}
        {s.webSearch ? t("atelier.prompts.webSearchOn") : t("atelier.prompts.webSearchOff")}
      </p>
      <p className="opacity-70">
        {t("atelier.robot.quota").replace("{used}", String(s.runsToday)).replace("{cap}", String(s.dailyCap))}
      </p>
      {s.webSearch ? <p className="opacity-70">{t("atelier.robot.slow")}</p> : null}

      {relaunch ? (
        <p className="mt-2">
          {t("atelier.robot.reason")} <span className="opacity-80">{s.lastReason}</span>
        </p>
      ) : null}

      {/* En révision et pas encore relancé : dire clairement que la balle est dans mon camp. */}
      {s.inRevision && !running ? (
        <p className="mt-2">{t("atelier.robot.waitingOnMe")}</p>
      ) : null}

      {/* Pendant le lancement : dire qu'il tourne, depuis quand, avec quoi. */}
      {running ? (
        <div className="mt-2">
          <p>
            {t("atelier.robot.inFlight")
              .replace("{robot}", s.runningRobot ?? t("atelier.none"))
              .replace("{model}", s.runningModel ?? t("atelier.none"))
              .replace("{ago}", s.runningSince ? ago(s.runningSince) : "—")}
          </p>
          <p className="opacity-70">{t("atelier.robot.running")}</p>
          {s.runningStale ? <p className="mt-1">{t("atelier.robot.stale")}</p> : null}
        </div>
      ) : null}

      {s.missing.length > 0 ? (
        <div className="mt-2">
          <p>{t("atelier.robot.blocked")}</p>
          <ul className="mt-1 list-disc pl-5">
            {s.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {s.lastRun?.status === "echoue" ? (
        <p className="mt-2">
          {t("atelier.robot.failed")} <span className="opacity-80">{s.lastRun.errorSummary}</span>
        </p>
      ) : null}
      {s.lastRun?.status === "termine" ? (
        <p className="mt-2 opacity-70">
          {t("atelier.robot.lastRun")} : {new Date(s.lastRun.createdAt).toLocaleString("fr-FR")} ·{" "}
          {s.lastRun.modelUsed ?? "—"}
          {s.lastRun.durationMs !== null ? ` · ${Math.round(s.lastRun.durationMs / 1000)} s` : ""}
        </p>
      ) : null}

      {notice ? <p className="mt-2">{notice}</p> : null}
      {error ? <p className="mt-2">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocked}
          onClick={() => run.mutate(relaunch ? "avec_precedent" : null)}
        >
          {relaunch ? t("atelier.robot.relaunch") : t("atelier.robot.launch")}
        </Button>

        {/* Repartir de zéro : le prompt actif, les données du livre et mes
            décisions tranchées — rien du livrable précédent. */}
        {s.hasPrevious ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={blocked}
            onClick={() => {
              const question = t("atelier.robot.freshConfirm").replace(
                "{n}",
                String(s.liveDecisions),
              );
              if (window.confirm(question)) run.mutate("sans_precedent");
            }}
          >
            {t("atelier.robot.fresh")}
          </Button>
        ) : null}

        {running ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={stop.isPending}
            onClick={() => {
              const question = `${t("atelier.robot.stopConfirm")} ${s.promptName ?? ""} — ${s.runningModel ?? ""}`;
              if (window.confirm(question)) stop.mutate();
            }}
          >
            {stop.isPending ? t("atelier.robot.stopping") : t("atelier.robot.stop")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
