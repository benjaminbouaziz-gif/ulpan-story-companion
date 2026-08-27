import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Room } from "@/components/AtelierRoom";
import { listRobotRuns } from "@/lib/atelier-robot.functions";

/**
 * LA SALLE ROBOTS : l'historique des lancements, une ligne par lancement.
 * On y lit ce qui compte : quand, quel livre, quel robot, quel modèle, le
 * statut, la durée, et le NOMBRE DE JETONS PRODUITS.
 */
function RunsTable() {
  const fetchRuns = useServerFn(listRobotRuns);
  const runs = useQuery({ queryKey: ["atelier", "robotRuns"], queryFn: () => fetchRuns() });

  if (runs.isPending) return <p>…</p>;
  if (runs.error) return <p>{runs.error.message}</p>;
  const lignes = runs.data ?? [];
  if (lignes.length === 0) return <p>Aucun lancement pour l'instant.</p>;

  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-line border-b">
          <th className="py-1 pr-3 font-normal opacity-70">Date et heure</th>
          <th className="py-1 pr-3 font-normal opacity-70">Livre</th>
          <th className="py-1 pr-3 font-normal opacity-70">Étape</th>
          <th className="py-1 pr-3 font-normal opacity-70">Robot</th>
          <th className="py-1 pr-3 font-normal opacity-70">Modèle</th>
          <th className="py-1 pr-3 font-normal opacity-70">Mode</th>
          <th className="py-1 pr-3 font-normal opacity-70">Statut</th>
          <th className="py-1 pr-3 font-normal opacity-70">Durée</th>
          <th className="py-1 pr-3 font-normal opacity-70">Jetons produits</th>
          <th className="py-1 pr-3 font-normal opacity-70">Coût</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((r) => (
          <tr key={r.id} className="border-line border-b align-top">
            <td className="py-1 pr-3 whitespace-nowrap">
              {new Date(r.createdAt).toLocaleString("fr-FR", {
                dateStyle: "short",
                timeStyle: "medium",
              })}
            </td>
            <td className="py-1 pr-3">{r.bookTitle ?? "—"}</td>
            <td className="py-1 pr-3">{r.stepLabel ?? "—"}</td>
            <td className="py-1 pr-3">{r.robot ?? "—"}</td>
            <td className="py-1 pr-3">{r.model ?? "—"}</td>
            <td className="py-1 pr-3">
              {r.mode === "avec_precedent"
                ? "avec mon motif"
                : r.mode === "sans_precedent"
                  ? "sans précédent"
                  : r.mode === "initial"
                    ? "premier lancement"
                    : "—"}
            </td>
            <td className="py-1 pr-3">
              {r.status ?? "—"}
              {r.truncated ? " · coupé" : ""}
              {r.errorSummary ? (
                <span className="block opacity-70">{r.errorSummary}</span>
              ) : null}
            </td>
            <td className="py-1 pr-3">
              {r.durationMs !== null ? `${Math.round(r.durationMs / 1000)} s` : "—"}
            </td>
            <td className="py-1 pr-3">
              {r.outputTokens !== null ? r.outputTokens.toLocaleString("fr-FR") : "—"}
            </td>
            <td className="py-1 pr-3">
              {r.costUsd !== null ? `${r.costUsd.toFixed(4)} $` : "inconnu"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const Route = createFileRoute("/atelier/robots")({
  head: () => ({
    meta: [{ title: "Robots — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <Room titleKey="atelier.room.robots" descKey="atelier.room.robots.desc">
      <RunsTable />
    </Room>
  ),
});
