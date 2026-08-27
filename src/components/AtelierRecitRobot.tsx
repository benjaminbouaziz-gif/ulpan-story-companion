import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useAtelierRefresh } from "@/lib/atelier-refresh";
import { cancelPlanRun } from "@/lib/atelier-robot.functions";
import {
  assembleRecit,
  recitState,
  writeChapter,
  writeRemainingChapters,
} from "@/lib/atelier-recit.functions";

/**
 * BRIQUE 8 — LE ROBOT DE RÉDACTION, À L'ÉCRAN.
 *
 * Un tableau : une ligne par chapitre du plan, avec le compte RÉEL de mots page
 * par page. Deux boutons pour avancer (le chapitre suivant, tous les restants),
 * un bouton par chapitre pour le réécrire seul, un bouton pour assembler.
 * Aucun bouton n'est éteint sur une condition de saisie : il reste cliquable et
 * nomme ce qui manque. Pendant qu'un lancement travaille, l'écran se relit tout
 * seul toutes les 5 secondes.
 */
export function RecitRobotPanel({
  bookStepId,
  onDone,
}: {
  bookStepId: string;
  onDone: () => void;
}) {
  const fetchState = useServerFn(recitState);
  const write = useServerFn(writeChapter);
  const writeAll = useServerFn(writeRemainingChapters);
  const assemble = useServerFn(assembleRecit);
  const cancel = useServerFn(cancelPlanRun);
  const refreshAtelier = useAtelierRefresh();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lignes, setLignes] = useState<string[]>([]);
  const [motifs, setMotifs] = useState<Record<number, string>>({});
  const [startedAt, setStartedAt] = useState<string>(() => new Date().toISOString());

  const state = useQuery({
    queryKey: ["atelier", "robotRecit", bookStepId],
    queryFn: () => fetchState({ data: { bookStepId } }),
    refetchInterval: (q) => (q.state.data?.running ? 5000 : false),
    refetchIntervalInBackground: false,
  });
  const s = state.data;

  const finir = async () => {
    await state.refetch();
    refreshAtelier();
    onDone();
  };

  const unChapitre = useMutation({
    mutationFn: (v: { chapterNo?: number; reason?: string }) =>
      write({
        data: {
          bookStepId,
          ...(v.chapterNo ? { chapterNo: v.chapterNo } : {}),
          ...(v.reason ? { reason: v.reason } : {}),
        },
      }),
    onMutate: () => {
      setError(null);
      setNotice(null);
      setLignes([]);
      setStartedAt(new Date().toISOString());
    },
    onSuccess: (r) =>
      setNotice(
        `Chapitre ${r.chapterNo} déposé en version ${r.artifactVersion} — ${r.mesure.pages.length} page(s) mesurée(s).`,
      ),
    onError: (e: Error) => setError(e.message),
    onSettled: finir,
  });

  const tousLesRestants = useMutation({
    mutationFn: () => writeAll({ data: { bookStepId } }),
    onMutate: () => {
      setError(null);
      setNotice(null);
      setLignes([]);
      setStartedAt(new Date().toISOString());
    },
    onSuccess: (maillons) => setLignes(maillons.map((m) => m.message)),
    onError: (e: Error) => setError(e.message),
    onSettled: finir,
  });

  const assembler = useMutation({
    mutationFn: () => assemble({ data: { bookStepId } }),
    onMutate: () => {
      setError(null);
      setNotice(null);
    },
    onSuccess: (r) =>
      setNotice(`Récit assemblé en version ${r.version} : ${r.pages} pages, numérotation continue.`),
    onError: (e: Error) => setError(e.message),
    onSettled: finir,
  });

  const stop = useMutation({
    mutationFn: () => cancel({ data: { bookStepId } }),
    onSuccess: async () => {
      setError(null);
      setNotice("Le lancement a été arrêté : la reprise repartira au chapitre suivant.");
      await finir();
    },
    onError: (e: Error) => setError(e.message),
  });

  const enTravail =
    (s?.running ?? false) || unChapitre.isPending || tousLesRestants.isPending || assembler.isPending;

  useEffect(() => {
    if (!enTravail) return;
    const id = setInterval(() => void state.refetch(), 5000);
    return () => clearInterval(id);
  }, [enTravail, state]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enTravail) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enTravail]);

  const wasWorking = useRef(false);
  useEffect(() => {
    if (wasWorking.current && !enTravail) {
      refreshAtelier();
      onDone();
    }
    wasWorking.current = enTravail;
  }, [enTravail, onDone, refreshAtelier]);

  if (!s || !s.isRedactionStep) return null;

  const ecrits = new Map(s.ecrits.map((e) => [e.chapterNo, e]));
  const restants = s.chapitres.filter((c) => !ecrits.has(c.chapterNo)).length;
  const depuis = Math.max(
    0,
    Math.round((now - new Date(s.runningSince ?? startedAt).getTime()) / 1000),
  );

  const cell = "border-line border-b px-2 py-1 text-left align-top";

  return (
    <div className="border-line mt-5 border-t pt-4">
      <h2 className="font-latin text-[16px]">Le robot de rédaction, chapitre par chapitre</h2>
      <p className="mt-1">
        Prompt : {s.promptName ?? "aucun"}
        {s.promptVersion !== null ? ` — version ${s.promptVersion}` : ""}
      </p>
      <p>Modèle : {s.model ?? "aucun"}</p>
      <p className="mt-1">
        Plan : {s.chapitres.length} chapitre(s), {s.totalPages} pages · calibrage exigé {s.motsMin} à{" "}
        {s.motsMax} mots par page.
      </p>
      <p>
        Écrits : {s.ecrits.length} · restants : {restants}
        {s.assembled
          ? ` · récit assemblé en version ${s.assembled.version} le ${new Date(s.assembled.createdAt).toLocaleString("fr-FR")}`
          : " · récit non assemblé"}
      </p>

      {s.missing.length > 0 ? (
        <div className="mt-2">
          <p>Ce qui manque avant d'écrire :</p>
          <ul className="mt-1 list-disc pl-5">
            {s.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {enTravail ? (
        <p className="mt-2">
          Le robot écrit
          {s.runningChapter !== null ? ` le chapitre ${s.runningChapter}` : ""}
          {s.runningModel ? ` · ${s.runningModel}` : ""} — depuis {depuis} s.
        </p>
      ) : null}

      {s.lastRun?.status === "echoue" ? (
        <p className="mt-2">
          Le dernier lancement a échoué
          {s.lastRun.batchCurrent !== null ? ` (chapitre ${s.lastRun.batchCurrent})` : ""} :{" "}
          <span className="opacity-80">{s.lastRun.errorSummary}</span>
        </p>
      ) : null}

      {/* Le tableau du calibrage : page par page, le compte réel. */}
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr>
            <th className={cell}>Chapitre</th>
            <th className={cell}>Titre</th>
            <th className={cell}>Pages du plan</th>
            <th className={cell}>Mesure réelle</th>
            <th className={cell}>État</th>
            <th className={cell}>Réécriture</th>
          </tr>
        </thead>
        <tbody>
          {s.chapitres.map((c) => {
            const e = ecrits.get(c.chapterNo);
            return (
              <tr key={c.chapterNo}>
                <td className={cell}>{c.chapterNo}</td>
                <td className={cell}>{c.titre || "—"}</td>
                <td className={cell}>
                  {c.pages} (p. {c.firstPage}–{c.lastPage})
                </td>
                <td className={cell}>
                  {e?.mesure
                    ? e.mesure.pages
                        .map((p) => `p.${p.pageNo} : ${p.words} mots${p.ok ? "" : " ⚠"}`)
                        .join(" · ")
                    : "—"}
                  {e?.mesure && e.mesure.problems.length > 0 ? (
                    <span className="block opacity-70">{e.mesure.problems.join(" · ")}</span>
                  ) : null}
                </td>
                <td className={cell}>
                  {e ? `écrit · version ${e.version}` : "à écrire"}
                </td>
                <td className={cell}>
                  {e ? (
                    <div className="flex flex-col gap-1">
                      <input
                        className="border-line border bg-transparent px-1 py-0.5"
                        placeholder="motif (facultatif)"
                        value={motifs[c.chapterNo] ?? ""}
                        onChange={(ev) =>
                          setMotifs((m) => ({ ...m, [c.chapterNo]: ev.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (enTravail) {
                            setError("Un lancement est déjà en cours sur cette étape.");
                            return;
                          }
                          const motif = (motifs[c.chapterNo] ?? "").trim();
                          if (
                            window.confirm(
                              `Réécrire le seul chapitre ${c.chapterNo} : une nouvelle version est déposée, les autres chapitres ne bougent pas.`,
                            )
                          )
                            unChapitre.mutate({
                              chapterNo: c.chapterNo,
                              ...(motif ? { reason: motif } : {}),
                            });
                        }}
                      >
                        Réécrire ce chapitre
                      </Button>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {notice ? <p className="mt-2">{notice}</p> : null}
      {error ? <p className="mt-2">{error}</p> : null}
      {lignes.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {lignes.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (enTravail) {
              setError("Un lancement est déjà en cours sur cette étape.");
              return;
            }
            if (s.missing.length > 0) {
              setError(s.missing.join(" · "));
              return;
            }
            if (s.nextChapter === null) {
              setError("Tous les chapitres du plan sont déjà écrits.");
              return;
            }
            unChapitre.mutate({ chapterNo: s.nextChapter });
          }}
        >
          {s.nextChapter === null
            ? "Écrire le chapitre suivant"
            : `Écrire le chapitre ${s.nextChapter}`}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (enTravail) {
              setError("Un lancement est déjà en cours sur cette étape.");
              return;
            }
            if (s.missing.length > 0) {
              setError(s.missing.join(" · "));
              return;
            }
            if (restants === 0) {
              setError("Aucun chapitre restant : tout est écrit.");
              return;
            }
            if (
              window.confirm(
                `Écrire les ${restants} chapitre(s) restant(s), un par un. Le premier échec arrête la série et l'écran dira où.`,
              )
            )
              tousLesRestants.mutate();
          }}
        >
          Écrire tous les chapitres restants
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (enTravail) {
              setError("Un lancement est déjà en cours sur cette étape.");
              return;
            }
            if (restants > 0) {
              setError(
                `Il reste ${restants} chapitre(s) à écrire : l'assemblage exige les ${s.chapitres.length} chapitres.`,
              );
              return;
            }
            assembler.mutate();
          }}
        >
          Assembler le récit
        </Button>

        {enTravail ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={stop.isPending}
            onClick={() => {
              if (window.confirm("Arrêter immédiatement ce lancement ?")) stop.mutate();
            }}
          >
            {stop.isPending ? "Arrêt…" : "Arrêter ce lancement"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
