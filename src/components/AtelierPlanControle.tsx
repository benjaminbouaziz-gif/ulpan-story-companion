import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { advancePlanControl, planControlState } from "@/lib/plan-controle.functions";

/**
 * LA VÉRIFICATION DU PLAN, VUE DE L'ÉDITEUR.
 *
 * Une progression en cinq mots, et rien de technique : « Plan généré »,
 * « Vérification », « Corrections ciblées en cours », « Vérification finale »,
 * puis « Votre validation est requise » ou « Arbitrage requis ».
 *
 * L'écran ne décide rien : il exécute le maillon que le serveur annonce, un
 * seul à la fois, et se relit tant qu'un appel tourne. La validation reste
 * ailleurs, entre les mains de l'éditeur : aucun bouton ici ne valide l'étape.
 */

const ETAPES = [
  "attente_plan",
  "verification",
  "corrections",
  "verification_finale",
  "validation_requise",
] as const;

const cell = "border-line border-b px-2 py-1 text-left align-top";

export function PlanControlPanel({
  bookStepId,
  onDone,
}: {
  bookStepId: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const lire = useServerFn(planControlState);
  const avancer = useServerFn(advancePlanControl);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  /** Ce qui a déjà été tenté : un maillon ne part jamais deux fois tout seul. */
  const tentes = useRef<Set<string>>(new Set());

  const etat = useQuery({
    queryKey: ["atelier", "plan-controle", bookStepId],
    queryFn: () => lire({ data: { bookStepId } }),
    refetchInterval: (q) => (q.state.data?.running ? 5000 : false),
  });

  const pas = useMutation({
    mutationFn: () => avancer({ data: { bookStepId } }),
    onSuccess: async (r) => {
      setMessage(r.message);
      await etat.refetch();
      onDone();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const data = etat.data ?? null;

  // L'ENCHAÎNEMENT FERMÉ : contrôle → réécriture → contrôle final, puis stop.
  // Chaque maillon n'est tenté qu'une fois : aucune boucle possible.
  useEffect(() => {
    if (!data || !data.applicable || data.running || !data.nextAction) return;
    if (pas.isPending) return;
    const cle = `${data.nextAction}:${data.planCourant?.version ?? 0}:${data.rapports.length}`;
    if (tentes.current.has(cle)) return;
    tentes.current.add(cle);
    pas.mutate();
  }, [data, pas]);

  if (!data?.applicable) return null;

  const rapportCourant = [...data.rapports]
    .reverse()
    .find((r) => r.planVersion === (data.planCourant?.version ?? -1));
  const indexPhase = ETAPES.indexOf(data.phase as (typeof ETAPES)[number]);

  return (
    <section className="border-line mt-6 border-t pt-4">
      <h2 className="font-latin text-[16px]">{t("atelier.pc.title")}</h2>

      {/* La progression : cinq mots, dans l'ordre, jamais du jargon. */}
      <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {ETAPES.map((e, i) => (
          <li
            key={e}
            className={
              data.phase === e
                ? "border-b border-current font-medium"
                : i < indexPhase
                  ? "opacity-60"
                  : "opacity-40"
            }
          >
            {i === 0 ? t("atelier.pc.planGenerated") : t(`atelier.pc.phase.${e}` as DictKey)}
          </li>
        ))}
        {data.phase === "arbitrage_requis" ? (
          <li className="border-b border-current font-medium">
            {t("atelier.pc.phase.arbitrage_requis")}
          </li>
        ) : null}
      </ol>

      {data.planCourant ? (
        <p className="mt-2">
          {t("atelier.pc.currentPlan")} · {t("atelier.pc.version")} {data.planCourant.version}
          {rapportCourant
            ? ` · ${rapportCourant.criteresPasses}/${rapportCourant.criteresTotal} ${t("atelier.pc.criteria")} · ${rapportCourant.bloquants} ${t("atelier.pc.blocking")} · ${rapportCourant.signalements} ${t("atelier.pc.warnings")}`
            : null}
        </p>
      ) : null}

      {data.running ? (
        <p className="mt-2">
          {data.phase === "corrections" ? t("atelier.pc.rewriting") : t("atelier.pc.running")}
        </p>
      ) : null}

      {data.message ? <p className="mt-2 opacity-80">{data.message}</p> : null}
      {message ? <p className="mt-1 opacity-80">{message}</p> : null}

      {!data.running && data.nextAction === "controle" ? (
        <button
          type="button"
          className="border-line mt-2 border px-2 py-0.5"
          disabled={pas.isPending}
          onClick={() => pas.mutate()}
        >
          {t("atelier.pc.start")}
        </button>
      ) : null}

      {/* Le détail des critères, replié : bloquants d'abord, puis signalements. */}
      {rapportCourant && rapportCourant.verdicts.length > 0 ? (
        <div className="mt-3">
          <button type="button" className="border-b border-current" onClick={() => setDetail((v) => !v)}>
            {detail ? t("atelier.pc.hideDetails") : t("atelier.pc.details")}
          </button>
          {detail ? (
            <table className="mt-2 w-full border-collapse">
              <tbody>
                {[...rapportCourant.verdicts]
                  .sort(
                    (a, b) =>
                      Number(b.verdict === "echoue") - Number(a.verdict === "echoue") ||
                      Number(b.isBlocking) - Number(a.isBlocking),
                  )
                  .map((v) => (
                    <tr key={v.code}>
                      <td className={cell}>{v.label}</td>
                      <td className={cell}>
                        {v.verdict === "echoue" ? t("atelier.pc.failed") : t("atelier.pc.ok")}
                        {v.verdict === "echoue"
                          ? ` · ${v.isBlocking ? t("atelier.pc.blocking") : t("atelier.pc.warnings")}`
                          : null}
                      </td>
                      <td className={cell}>
                        {v.species === "mecanique" ? t("atelier.pc.measured") : t("atelier.pc.judged")}
                      </td>
                      <td className={cell}>
                        {v.location ? <span className="block opacity-70">{v.location}</span> : null}
                        {v.explanation ? <span className="block whitespace-pre-line">{v.explanation}</span> : null}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}

      {/* La comparaison v1 / v2, une fois la réécriture passée. */}
      {data.comparaison && data.comparaison.length > 0 && data.versionsPlan.length >= 2 ? (
        <div className="mt-4">
          <h3 className="font-latin text-[14px]">{t("atelier.pc.compare")}</h3>
          <table className="mt-1 w-full border-collapse">
            <tbody>
              {data.comparaison.map((l) => (
                <tr key={l.chapterNo}>
                  <td className={cell}>
                    {t("atelier.pc.chapter")} {l.chapterNo}
                  </td>
                  <td className={cell}>{t(`atelier.pc.state.${l.etat}` as DictKey)}</td>
                  <td className={cell}>
                    {l.etat === "modifie" && l.titreAvant !== l.titreApres ? (
                      <>
                        <span className="block opacity-70">{l.titreAvant}</span>
                        <span className="block">{l.titreApres}</span>
                      </>
                    ) : (
                      (l.titreApres ?? l.titreAvant ?? "—")
                    )}
                  </td>
                  <td className={cell}>
                    {l.pagesAvant === l.pagesApres
                      ? `${l.pagesApres ?? "—"} ${t("atelier.pc.pages")}`
                      : `${l.pagesAvant ?? "—"} → ${l.pagesApres ?? "—"} ${t("atelier.pc.pages")}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
