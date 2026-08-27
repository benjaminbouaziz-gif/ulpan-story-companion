import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import { launchPlanRobot, planRobotState } from "@/lib/atelier-robot.functions";

/**
 * LE ROBOT DE L'ÉTAPE « PLAN DE CHAPITRES ».
 *
 * Un seul bouton, et au-dessus de lui la vérité : quel prompt, quelle version,
 * quel modèle, avec ou sans recherche en ligne. Quand quelque chose manque, le
 * bouton reste éteint et la raison est écrite en clair — jamais « erreur ».
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
  const [error, setError] = useState<string | null>(null);

  const state = useQuery({
    queryKey: ["atelier", "robotPlan", bookStepId],
    queryFn: () => fetchState({ data: { bookStepId } }),
  });

  const run = useMutation({
    mutationFn: (withReason: boolean) => launch({ data: { bookStepId, withReason } }),
    onSuccess: async () => {
      setError(null);
      await state.refetch();
      onDone();
    },
    onError: (e: Error) => setError(e.message),
  });

  const s = state.data;
  if (!s || !s.isPlanStep) return null;

  const relaunch = s.hasPrevious && s.lastReason !== null;
  const blocked = s.missing.length > 0 || run.isPending;

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

      {relaunch ? (
        <p className="mt-2">
          {t("atelier.robot.reason")} <span className="opacity-80">{s.lastReason}</span>
        </p>
      ) : null}

      {s.running ? <p className="mt-2">{t("atelier.robot.running")}</p> : null}

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
      {s.lastRun?.status === "ok" ? (
        <p className="mt-2 opacity-70">
          {t("atelier.robot.lastRun")} : {new Date(s.lastRun.createdAt).toLocaleString("fr-FR")} ·{" "}
          {s.lastRun.modelUsed ?? "—"}
          {s.lastRun.durationMs !== null ? ` · ${Math.round(s.lastRun.durationMs / 1000)} s` : ""}
        </p>
      ) : null}

      {error ? <p className="mt-2">{error}</p> : null}

      <button
        type="button"
        className="border-line mt-3 border px-2 py-0.5 disabled:opacity-40"
        disabled={blocked}
        onClick={() => run.mutate(relaunch)}
      >
        {relaunch ? t("atelier.robot.relaunch") : t("atelier.robot.launch")}
      </button>
    </div>
  );
}
