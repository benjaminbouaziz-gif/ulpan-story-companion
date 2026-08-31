import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Room } from "@/components/AtelierRoom";
import { useAtelierRefresh } from "@/lib/atelier-refresh";
import {
  deleteQcCriterion,
  qcGrids,
  qcSettings,
  saveQcCriterion,
  setQcEnabled,
  type QcGridRow,
} from "@/lib/qc.functions";

/**
 * BRIQUE 9 — LA SALLE QUALITÉ.
 *
 * Deux choses seulement : l'INTERRUPTEUR GLOBAL — à l'arrêt, la chaîne se
 * comporte exactement comme avant, aucun contrôleur n'est appelé — et les
 * GRILLES DE CRITÈRES, éditables ici sans redéploiement.
 *
 * Un critère « mécanique » n'est jamais soumis à un modèle : son verdict est
 * calculé par le code (module de calibrage) à partir de sa clé de calcul.
 */
export const Route = createFileRoute("/atelier/qualite")({
  head: () => ({
    meta: [{ title: "Qualité — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: QualityRoom,
});

const cell = "border-line border-b px-2 py-1 text-left align-top";

const FAMILLES = [
  { v: "conformite", l: "Conformité fiche" },
  { v: "structure", l: "Structure" },
  { v: "pedagogie", l: "Pédagogie" },
  { v: "langue", l: "Langue" },
] as const;

/** Les clés de calcul câblées sur recit-calibrage.ts, côté serveur. */
const CLES_MECANIQUES = [
  // Grille « Plan »
  "plan_structure",
  "plan_numerotation",
  // Grille « Récit » — toutes lues par le module de calibrage existant.
  "nombre_pages",
  "pagination",
  "calibrage",
  "entetes",
];

type Brouillon = {
  id?: string;
  gridId: string;
  sortOrder: number;
  code: string;
  label: string;
  question: string;
  family: (typeof FAMILLES)[number]["v"];
  isBlocking: boolean;
  species: "juge" | "mecanique";
  mechanicKey: string | null;
};

function nouveau(grid: QcGridRow): Brouillon {
  const dernier = grid.criteres.reduce((n, c) => Math.max(n, c.sortOrder), 0);
  return {
    gridId: grid.id,
    sortOrder: dernier + 1,
    code: "",
    label: "",
    question: "",
    family: "structure",
    isBlocking: false,
    species: "juge",
    mechanicKey: null,
  };
}

function QualityRoom() {
  const invalidate = useAtelierRefresh();
  const fetchSettings = useServerFn(qcSettings);
  const fetchGrids = useServerFn(qcGrids);
  const setEnabled = useServerFn(setQcEnabled);
  const saveCriterion = useServerFn(saveQcCriterion);
  const removeCriterion = useServerFn(deleteQcCriterion);

  const [message, setMessage] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);

  const settings = useQuery({ queryKey: ["atelier", "qc", "settings"], queryFn: () => fetchSettings() });
  const grids = useQuery({ queryKey: ["atelier", "qc", "grids"], queryFn: () => fetchGrids() });

  const basculer = useMutation({
    mutationFn: (enabled: boolean) => setEnabled({ data: { enabled } }),
    onSuccess: (r) => {
      setMessage(
        r.enabled
          ? "Contrôle qualité en marche. Chaque étape garde sa propre stratégie ; celles réglées sur « aucun contrôle » ne changent pas de comportement."
          : "Contrôle qualité à l'arrêt. La chaîne se comporte exactement comme avant : aucun contrôleur n'est appelé.",
      );
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const enregistrer = useMutation({
    mutationFn: (b: Brouillon) =>
      saveCriterion({
        data: {
          ...(b.id ? { id: b.id } : {}),
          gridId: b.gridId,
          sortOrder: b.sortOrder,
          code: b.code,
          label: b.label,
          question: b.question,
          family: b.family,
          isBlocking: b.isBlocking,
          species: b.species,
          mechanicKey: b.mechanicKey,
        },
      }),
    onSuccess: () => {
      setBrouillon(null);
      setMessage("Critère enregistré.");
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const retirer = useMutation({
    mutationFn: (id: string) => removeCriterion({ data: { id } }),
    onSuccess: () => {
      setMessage("Critère retiré de la grille. Les rapports déjà rendus le conservent.");
      invalidate();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const champ = "border-line w-full border bg-transparent px-1 py-0.5";

  return (
    <Room titleKey="atelier.room.quality" descKey="atelier.room.quality.desc">
      <div className="text-[13px]">
        <h2 className="font-latin text-[16px]">L'interrupteur général</h2>
        <p className="mt-1">
          État : {settings.isLoading ? "…" : settings.data?.enabled ? "en marche" : "à l'arrêt"}.
        </p>
        <button
          type="button"
          className="border-line mt-2 border px-2 py-0.5"
          disabled={basculer.isPending || settings.isLoading}
          onClick={() => basculer.mutate(!(settings.data?.enabled ?? false))}
        >
          {settings.data?.enabled ? "Arrêter le contrôle qualité" : "Mettre le contrôle qualité en marche"}
        </button>
        <p className="mt-2 opacity-70">
          À l'arrêt, aucun contrôleur n'est appelé et aucun lancement de contrôle n'apparaît dans la salle Robots.
        </p>

        <h2 className="font-latin mt-8 text-[16px]">Les mesures — calculées par le code, non modifiables ici</h2>
        {grids.isLoading ? (
          <p className="mt-2">…</p>
        ) : (grids.data ?? []).length === 0 ? (
          <p className="mt-2">Aucune grille.</p>
        ) : (
          (grids.data ?? []).map((g) => (
            <div key={g.id} className="mt-6">
              <h3 className="font-latin text-[15px]">
                {g.name} · étape {g.stepCode} · {g.criteres.filter((c) => c.isActive).length} mesure(s) active(s)
              </h3>
              <table className="mt-2 w-full border-collapse">
                <thead>
                  <tr>
                    <th className={cell}>Ordre</th>
                    <th className={cell}>Mesure</th>
                    <th className={cell}>Famille</th>
                    <th className={cell}>Bloquant</th>
                    <th className={cell}>Clé de calcul</th>
                  </tr>
                </thead>
                <tbody>
                  {g.criteres
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <tr key={c.id}>
                        <td className={cell}>{c.sortOrder}</td>
                        <td className={cell}>
                          {c.label}
                          <span className="block opacity-70">{c.code}</span>
                        </td>
                        <td className={cell}>{c.familyLabel}</td>
                        <td className={cell}>{c.isBlocking ? "oui" : "non"}</td>
                        <td className={cell}>{c.mechanicKey ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        <h2 className="font-latin mt-10 text-[16px]">Les règles jugées</h2>
        <p className="mt-1 max-w-[620px]">
          Une règle jugée ne se saisit plus ici : elle s'écrit dans son prompt, versionnée comme le reste.
        </p>
        {regles.isLoading ? (
          <p className="mt-2">…</p>
        ) : (
          (regles.data ?? []).map((r) => (
            <div key={r.stepCode} className="mt-5">
              <h3 className="font-latin text-[15px]">
                {r.stepLabel} · {r.promptName ?? r.promptCode}
                {r.version !== null ? ` · version ${r.version}` : ""}
              </h3>
              {r.erreur ? (
                <p className="mt-1">{r.erreur}</p>
              ) : (
                <p className="mt-1">
                  {r.codes.length} règle(s) lue(s) : {r.codes.join(", ")}
                </p>
              )}
              {r.promptId ? (
                <Link to="/atelier/prompts" className="mt-1 inline-block border-b border-current">
                  Modifier les règles dans la bibliothèque de prompts
                </Link>
              ) : null}
            </div>
          ))
        )}


        {message ? <p className="mt-4">{message}</p> : null}
      </div>
    </Room>
  );
}
