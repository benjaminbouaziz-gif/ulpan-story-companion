import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Room } from "@/components/AtelierRoom";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { atelierQueue, type QueueStep } from "@/lib/atelier-queue.functions";
import { qcQueueVerdicts } from "@/lib/qc.functions";

/**
 * LE TABLEAU DE BORD — UNE SEULE FILE.
 *
 * Pas de panorama, pas de vue par livre : la prochaine chose à faire. L'ordre
 * vient du serveur : l'étape qui attend depuis le plus longtemps d'abord. Tout
 * est lu en base à l'affichage ; aucun compteur décoratif, aucun graphique,
 * aucune couleur de statut : le statut se lit en toutes lettres.
 */
export const Route = createFileRoute("/atelier/")({
  head: () => ({
    meta: [{ title: "Tableau de bord — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: Dashboard,
});

const cell = "border-line border-b px-2 py-1 text-left align-top";

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("fr-FR") : "—";
}

function Dashboard() {
  const { t } = useI18n();
  const fetchQueue = useServerFn(atelierQueue);
  const queue = useQuery({ queryKey: ["atelier", "queue"], queryFn: () => fetchQueue() });

  /**
   * BRIQUE 9 — le verdict de contrôle de chaque étape, en une ligne. La file
   * est mon point d'entrée : je ne vais dans le dossier que si elle m'y envoie.
   */
  const fetchVerdicts = useServerFn(qcQueueVerdicts);
  const verdicts = useQuery({ queryKey: ["atelier", "qc", "queue"], queryFn: () => fetchVerdicts() });
  const verdict = (s: QueueStep) =>
    (verdicts.data ?? []).find((v) => v.stepId === s.stepId)?.line ?? "aucun contrôle";

  const openLink = (s: QueueStep) => (
    <Link to="/atelier/etape/$id" params={{ id: s.stepId }} className="border-b border-current">
      {t("atelier.queue.open")}
    </Link>
  );

  const block = (
    titleKey: DictKey,
    emptyKey: DictKey,
    rows: QueueStep[],
    extraKey: DictKey | null,
    extra?: (s: QueueStep) => string,
  ) => (
    <div className="mt-8">
      <h2 className="font-latin text-[16px]">{t(titleKey)}</h2>
      {rows.length === 0 ? (
        <p className="mt-2">{t(emptyKey)}</p>
      ) : (
        <table className="mt-2 w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={cell}>{t("atelier.queue.col.book")}</th>
              <th className={cell}>{t("atelier.queue.col.step")}</th>
              <th className={cell}>{t("atelier.books.col.status")}</th>
              {extraKey ? <th className={cell}>{t(extraKey)}</th> : null}
              <th className={cell}>Contrôle</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.stepId}>
                <td className={cell}>{s.bookTitle}</td>
                <td className={cell}>{s.labelFr}</td>
                <td className={cell}>{t(`atelier.status.${s.status}` as DictKey)}</td>
                {extraKey ? <td className={cell}>{extra ? extra(s) : t("atelier.none")}</td> : null}
                <td className={cell}>{verdict(s)}</td>
                <td className={cell}>{openLink(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const data = queue.data;

  return (
    <Room titleKey="atelier.room.dashboard" descKey="atelier.room.dashboard.desc">
      {queue.isLoading || !data ? (
        <p className="text-[13px]">…</p>
      ) : (
        <>
          <h2 className="font-latin text-[16px]">{t("atelier.queue.signature")}</h2>
          {data.signature.length === 0 ? (
            <p className="mt-2">{t("atelier.queue.noSignature")}</p>
          ) : (
            <table className="mt-2 w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={cell}>{t("atelier.queue.col.book")}</th>
                  <th className={cell}>{t("atelier.queue.col.step")}</th>
                  <th className={cell}>{t("atelier.queue.col.since")}</th>
                  <th className={cell}>{t("atelier.queue.col.artifact")}</th>
                  <th className={cell}>Contrôle</th>
                  <th className={cell} />
                </tr>
              </thead>
              <tbody>
                {data.signature.map((s) => (
                  <tr key={s.stepId}>
                    <td className={cell}>{s.bookTitle}</td>
                    <td className={cell}>{s.labelFr}</td>
                    <td className={cell}>{formatDate(s.since)}</td>
                    <td className={cell}>
                      {s.lastArtifact
                        ? `${s.lastArtifact.type} · ${t("atelier.step.version")} ${s.lastArtifact.version}`
                        : t("atelier.step.noArtifacts")}
                    </td>
                    <td className={cell}>{verdict(s)}</td>
                    <td className={cell}>{openLink(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {block("atelier.queue.running", "atelier.queue.noRunning", data.running, "atelier.queue.col.robot", (s) =>
            s.robotName ?? t("atelier.none"),
          )}
          {block("atelier.queue.revision", "atelier.queue.noRevision", data.revision, "atelier.books.col.awaiting", (s) =>
            s.awaiting ? t(`atelier.awaiting.${s.awaiting}` as DictKey) : t("atelier.none"),
          )}
          {block("atelier.queue.failed", "atelier.queue.noFailed", data.failed, "atelier.queue.col.error", (s) =>
            s.errorSummary ?? t("atelier.none"),
          )}

          <div className="mt-8">
            <h2 className="font-latin text-[16px]">{t("atelier.queue.moves")}</h2>
            {data.moves.length === 0 ? (
              <p className="mt-2">{t("atelier.queue.noMoves")}</p>
            ) : (
              <table className="mt-2 w-full border-collapse text-[13px]">
                <tbody>
                  {data.moves.map((m) => (
                    <tr key={m.id}>
                      <td className={cell}>{formatDate(m.at)}</td>
                      <td className={cell}>{m.bookTitle}</td>
                      <td className={cell}>{m.stepLabelFr}</td>
                      <td className={cell}>
                        {m.kind === "depot"
                          ? `${t("atelier.step.deposit")} · ${m.label}`
                          : m.label === "valide"
                            ? t("atelier.step.approve")
                            : t("atelier.step.reject")}
                        {m.comment ? <span className="block opacity-70">{m.comment}</span> : null}
                      </td>
                      <td className={cell}>
                        <Link
                          to="/atelier/etape/$id"
                          params={{ id: m.stepId }}
                          className="border-b border-current"
                        >
                          {t("atelier.queue.open")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Room>
  );
}
