import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { MODES_CONTROLE } from "@/lib/atelier-models";
import { planControlSettings, setPlanControlSettings } from "@/lib/plan-controle.functions";
import { testerModeles, type TestModele } from "@/lib/atelier-model-test.functions";

/**
 * RÉGLAGES DU CONTRÔLE DU PLAN + TEST DES MODÈLES.
 *
 * L'interrupteur est la garantie du « rien ne casse » : arrêté, le plan v1 va
 * directement à la signature comme avant la brique. Les modèles affichés sont
 * ceux des prompts moteurs — on ne choisit pas un modèle ici, on le lit.
 */
export function ControleReglages() {
  const fetchReglages = useServerFn(planControlSettings);
  const enregistrer = useServerFn(setPlanControlSettings);
  const tester = useServerFn(testerModeles);
  const [tests, setTests] = useState<TestModele[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["atelier", "controleReglages"], queryFn: () => fetchReglages() });

  const maj = useMutation({
    mutationFn: (patch: { enabled?: boolean; mode?: "A" | "B" | "C" }) => enregistrer({ data: patch }),
    onSuccess: () => void q.refetch(),
    onError: (e: Error) => setError(e.message),
  });

  const essai = useMutation({
    mutationFn: () => tester({}),
    onSuccess: (res) => setTests(res),
    onError: (e: Error) => setError(e.message),
  });

  const r = q.data;

  return (
    <section className="border-line mt-6 border-t pt-5">
      <h2 className="font-latin text-[16px]">Contrôle du plan de chapitres</h2>
      <p className="mt-1 text-[13px] opacity-80">
        Arrêté, rien ne change : le plan va directement à votre signature.
      </p>

      {!r ? (
        <p className="mt-3 text-[13px]">…</p>
      ) : (
        <>
          <label className="mt-3 flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={r.enabled}
              disabled={maj.isPending}
              onChange={(e) => maj.mutate({ enabled: e.target.checked })}
            />
            Contrôle en marche
          </label>

          <fieldset className="mt-4">
            <legend className="text-[13px]">Mode</legend>
            {MODES_CONTROLE.map((m) => (
              <label key={m.code} className="mt-2 flex items-start gap-2 text-[13px]">
                <input
                  type="radio"
                  name="mode-controle"
                  className="mt-1"
                  checked={r.mode === m.code}
                  disabled={maj.isPending}
                  onChange={() => maj.mutate({ mode: m.code })}
                />
                <span>
                  {m.label}
                  <span className="block opacity-80">{m.desc}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="mt-4 text-[13px]">
            Modèles lus sur les prompts moteurs : contrôleur {r.modeleControleur ?? "—"} · rédacteur{" "}
            {r.modeleRedacteur ?? "—"}
          </p>

          {r.manques.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-[13px]">
              {r.manques.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      <div className="mt-4">
        <Button type="button" variant="outline" size="sm" disabled={essai.isPending} onClick={() => essai.mutate()}>
          {essai.isPending ? "…" : "Tester les modèles"}
        </Button>
      </div>

      {tests ? (
        <ul className="mt-3 space-y-2 text-[13px]">
          {tests.map((t) => (
            <li key={t.demande} className="border-line border-t pt-2">
              <p>
                {t.label} — {t.ok ? "réponse reçue" : "échec"} en {Math.round(t.durationMs / 1000)} s
              </p>
              <p className="opacity-80">
                demandé : {t.demande} · a répondu : {t.modelUsed ?? "—"}
              </p>
              {t.message ? <p className="opacity-80">{t.message}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="mt-3 text-[13px]">{error}</p> : null}
    </section>
  );
}
