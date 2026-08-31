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

        <h2 className="font-latin mt-8 text-[16px]">Les grilles de critères</h2>
        {grids.isLoading ? (
          <p className="mt-2">…</p>
        ) : (grids.data ?? []).length === 0 ? (
          <p className="mt-2">Aucune grille.</p>
        ) : (
          (grids.data ?? []).map((g) => (
            <div key={g.id} className="mt-6">
              <h3 className="font-latin text-[15px]">
                {g.name} · étape {g.stepCode} · {g.criteres.filter((c) => c.isActive).length} critère(s) actif(s)
              </h3>
              <table className="mt-2 w-full border-collapse">
                <thead>
                  <tr>
                    <th className={cell}>Ordre</th>
                    <th className={cell}>Critère</th>
                    <th className={cell}>Question posée</th>
                    <th className={cell}>Famille</th>
                    <th className={cell}>Bloquant</th>
                    <th className={cell}>Espèce</th>
                    <th className={cell} />
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
                        <td className={cell}>{c.question}</td>
                        <td className={cell}>{c.familyLabel}</td>
                        <td className={cell}>{c.isBlocking ? "oui" : "non"}</td>
                        <td className={cell}>
                          {c.species === "mecanique" ? `mécanique · ${c.mechanicKey ?? "—"}` : "jugé"}
                        </td>
                        <td className={cell}>
                          <button
                            type="button"
                            className="border-b border-current"
                            onClick={() =>
                              setBrouillon({
                                id: c.id,
                                gridId: g.id,
                                sortOrder: c.sortOrder,
                                code: c.code,
                                label: c.label,
                                question: c.question,
                                family: c.family,
                                isBlocking: c.isBlocking,
                                species: c.species,
                                mechanicKey: c.mechanicKey,
                              })
                            }
                          >
                            Modifier
                          </button>
                          {" · "}
                          <button
                            type="button"
                            className="border-b border-current"
                            onClick={() => {
                              if (window.confirm(`Retirer « ${c.label} » de la grille ?`)) retirer.mutate(c.id);
                            }}
                          >
                            Retirer
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <button
                type="button"
                className="border-line mt-2 border px-2 py-0.5"
                onClick={() => setBrouillon(nouveau(g))}
              >
                Ajouter un critère
              </button>
            </div>
          ))
        )}

        {brouillon ? (
          <div className="border-line mt-8 max-w-[620px] border-t pt-4">
            <h3 className="font-latin text-[15px]">
              {brouillon.id ? "Modifier le critère" : "Nouveau critère"}
            </h3>
            <div className="mt-2 space-y-2">
              <label className="block">
                Ordre
                <input
                  type="number"
                  min={1}
                  className={champ}
                  value={brouillon.sortOrder}
                  onChange={(e) => setBrouillon({ ...brouillon, sortOrder: Number(e.target.value) })}
                />
              </label>
              <label className="block">
                Code (court, stable)
                <input
                  className={champ}
                  value={brouillon.code}
                  onChange={(e) => setBrouillon({ ...brouillon, code: e.target.value })}
                />
              </label>
              <label className="block">
                Libellé
                <input
                  className={champ}
                  value={brouillon.label}
                  onChange={(e) => setBrouillon({ ...brouillon, label: e.target.value })}
                />
              </label>
              <label className="block">
                Question exacte posée au contrôleur
                <textarea
                  rows={3}
                  className={champ}
                  value={brouillon.question}
                  onChange={(e) => setBrouillon({ ...brouillon, question: e.target.value })}
                />
              </label>
              <label className="block">
                Famille
                <select
                  className={champ}
                  value={brouillon.family}
                  onChange={(e) =>
                    setBrouillon({ ...brouillon, family: e.target.value as Brouillon["family"] })
                  }
                >
                  {FAMILLES.map((f) => (
                    <option key={f.v} value={f.v}>
                      {f.l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={brouillon.isBlocking}
                  onChange={(e) => setBrouillon({ ...brouillon, isBlocking: e.target.checked })}
                />
                <span>Bloquant : un seul échec et l'étape n'est pas validée, quelles que soient les notes.</span>
              </label>
              <label className="block">
                Espèce
                <select
                  className={champ}
                  value={brouillon.species}
                  onChange={(e) => {
                    const species = e.target.value as "juge" | "mecanique";
                    setBrouillon({
                      ...brouillon,
                      species,
                      mechanicKey: species === "mecanique" ? (brouillon.mechanicKey ?? CLES_MECANIQUES[0] ?? null) : null,
                    });
                  }}
                >
                  <option value="juge">jugé — verdict rendu par le contrôleur</option>
                  <option value="mecanique">mécanique — verdict calculé par le code</option>
                </select>
              </label>
              {brouillon.species === "mecanique" ? (
                <label className="block">
                  Clé de calcul (module de calibrage)
                  <select
                    className={champ}
                    value={brouillon.mechanicKey ?? ""}
                    onChange={(e) => setBrouillon({ ...brouillon, mechanicKey: e.target.value })}
                  >
                    {CLES_MECANIQUES.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className="border-line border px-2 py-0.5"
                disabled={enregistrer.isPending}
                onClick={() => enregistrer.mutate(brouillon)}
              >
                Enregistrer
              </button>
              <button type="button" className="border-b border-current" onClick={() => setBrouillon(null)}>
                Annuler
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className="mt-4">{message}</p> : null}
      </div>
    </Room>
  );
}
