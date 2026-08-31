import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Room } from "@/components/AtelierRoom";
import { planControlMeasures } from "@/lib/plan-controle.functions";

/**
 * LA MESURE — l'historique des contrôles de plan, sans jugement ajouté :
 * les notes du contrôleur, la moyenne, le nombre de propositions, et surtout
 * quel modèle a réellement répondu.
 */
export const Route = createFileRoute("/atelier/mesure")({
  head: () => ({ meta: [{ title: "Mesure — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }] }),
  component: MeasureRoom,
});

function MeasureRoom() {
  const fetchRows = useServerFn(planControlMeasures);
  const q = useQuery({ queryKey: ["atelier", "mesure"], queryFn: () => fetchRows() });
  const rows = q.data ?? [];

  return (
    <Room titleKey="atelier.room.measure" descKey="atelier.room.measure.desc">
      {q.isLoading ? <p className="text-[13px]">…</p> : null}
      {!q.isLoading && rows.length === 0 ? (
        <p className="text-[13px]">Aucun contrôle de plan n'a encore été lancé.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-line border-b text-left">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Livre</th>
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 pr-3 font-medium">Mode</th>
                <th className="py-2 pr-3 font-medium">État</th>
                <th className="py-2 pr-3 font-medium">Structure</th>
                <th className="py-2 pr-3 font-medium">Progression</th>
                <th className="py-2 pr-3 font-medium">Méthode</th>
                <th className="py-2 pr-3 font-medium">Cohérence</th>
                <th className="py-2 pr-3 font-medium">Moyenne</th>
                <th className="py-2 pr-3 font-medium">Propositions</th>
                <th className="py-2 pr-3 font-medium">Contrôleur</th>
                <th className="py-2 font-medium">Rédacteur</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-line border-b align-top">
                  <td className="py-2 pr-3">{new Date(r.createdAt).toLocaleString("fr-FR")}</td>
                  <td className="py-2 pr-3">{r.bookTitle}</td>
                  <td className="py-2 pr-3">{r.planVersion === null ? "—" : `v${r.planVersion}`}</td>
                  <td className="py-2 pr-3">{r.mode}</td>
                  <td className="py-2 pr-3">{r.status}</td>
                  <td className="py-2 pr-3">{r.notes?.structure ?? "—"}</td>
                  <td className="py-2 pr-3">{r.notes?.progression ?? "—"}</td>
                  <td className="py-2 pr-3">{r.notes?.methode ?? "—"}</td>
                  <td className="py-2 pr-3">{r.notes?.coherence_recit ?? "—"}</td>
                  <td className="py-2 pr-3">{r.moyenne ?? "—"}</td>
                  <td className="py-2 pr-3">{r.propositions}</td>
                  <td className="py-2 pr-3">{r.controleurModelUsed ?? "—"}</td>
                  <td className="py-2">{r.redacteurModelUsed ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Room>
  );
}
