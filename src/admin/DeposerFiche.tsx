import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { analyserFiche, deposerFiche } from "@/lib/admin-fiche.functions";
import { ligneProbleme } from "@/lib/fiche-json";
import { messageErreur } from "@/admin/textes";
import { btnCls, btnPrimaryCls } from "@/admin/ui";

type Rapport = Awaited<ReturnType<typeof analyserFiche>>;
const ACTION = { creer: "sera créé(e)", modifier: "sera modifié(e)", inchangee: "ne sera pas modifiée" } as const;

/** Dépôt d'une fiche livre JSON : analyse automatique, rapport copiable, écriture si aucune erreur. */
export function DeposerFiche({ onDone }: { onDone: () => void }) {
  const analyse = useServerFn(analyserFiche);
  const deposer = useServerFn(deposerFiche);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [contenu, setContenu] = useState("");
  const [nom, setNom] = useState<string | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [analyse_, setAnalyse_] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  const [fait, setFait] = useState<{ slug: string; resume: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function lancer(src: string, fichier: string | null = null) {
    setContenu(src);
    setNom(fichier);
    setMsg(null);
    setCopie(null);
    setFait(null);
    setBusy(true);
    try {
      setRapport(await analyse({ data: { contenu: src } }));
      setAnalyse_(src);
    } catch (e) {
      setRapport(null);
      setMsg(messageErreur(e));
    } finally {
      setBusy(false);
    }
  }

  function lignesPlan(r: Rapport): string[] {
    if (!r.plan) return [];
    return [
      `Collection : ${ACTION[r.plan.collection.action]}.`,
      `Livre « ${r.slug} » : ${ACTION[r.plan.livre.action]}${r.plan.livre.renommeDepuis ? ` (renommé depuis « ${r.plan.livre.renommeDepuis} »)` : ""}.`,
      ...r.plan.editions.map((e) => `Édition ${e.lang.toUpperCase()} : ${ACTION[e.action]}.`),
    ];
  }

  async function copier(r: Rapport) {
    const txt = [
      `Rapport d'analyse — ${nom ?? "fiche collée"}`,
      ...(r.erreurs.length ? [`Erreurs (${r.erreurs.length}) :`, ...r.erreurs.map((p) => `- ${ligneProbleme(p)}`)] : ["Aucune erreur.", ...lignesPlan(r)]),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      setCopie("Rapport copié.");
    } catch {
      setCopie("Copie impossible : sélectionnez le texte à la main.");
    }
  }

  async function ecrire() {
    setBusy(true);
    try {
      const r = await deposer({ data: { contenu } });
      setFait(r);
      setRapport(null);
      setAnalyse_(null);
      onDone();
    } catch (e) {
      setMsg(e instanceof Error && e.message.includes("FICHE_INVALID") ? "Le serveur a trouvé des erreurs : rien n'a été écrit." : messageErreur(e));
    } finally {
      setBusy(false);
    }
  }

  const ok = !!rapport && rapport.erreurs.length === 0 && analyse_ === contenu;

  return (
    <div className="border-line mt-4 max-w-[760px] border p-4 text-[13px]">
      <h2 className="text-[17px]">Déposer une fiche livre (JSON)</h2>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) void lancer(await f.text(), f.name);
      }} />
      <div className="border-line mt-2 border border-dashed p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void lancer(await f.text(), f.name); }}>
        <p>Déposez un fichier JSON ici, <button type="button" className="underline" onClick={() => fileRef.current?.click()}>choisissez-le</button>, ou collez son contenu :</p>
        <textarea aria-label="Contenu de la fiche" className="border-line mt-2 h-40 w-full border p-2 font-mono text-[12px]" value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          onPaste={(e) => { const el = e.currentTarget; setTimeout(() => void lancer(el.value), 0); }} />
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" className={btnCls} disabled={!contenu.trim() || busy} onClick={() => void lancer(contenu, nom)}>Analyser</button>
        {ok && <button type="button" className={btnPrimaryCls} disabled={busy} onClick={() => void ecrire()}>Enregistrer la fiche</button>}
      </div>
      {msg && <p className="mt-2">{msg}</p>}

      {rapport && (
        <div className="mt-3 space-y-2" data-rapport-fiche>
          {rapport.erreurs.length > 0 ? (
            <div className="border-line border p-2">
              <p className="font-semibold">Erreurs ({rapport.erreurs.length}) — rien ne sera écrit :</p>
              <ul className="list-disc pl-5">{rapport.erreurs.map((p, i) => <li key={i}>{ligneProbleme(p)}</li>)}</ul>
            </div>
          ) : (
            <div className="border-line border p-2">
              <p className="font-semibold">Aucune erreur.</p>
              <ul className="list-disc pl-5">{lignesPlan(rapport).map((l, i) => <li key={i}>{l}</li>)}</ul>
            </div>
          )}
          <button type="button" className={btnCls} onClick={() => void copier(rapport)}>Copier le rapport</button>
          {copie && <span className="ml-2">{copie}</span>}
        </div>
      )}

      {fait && (
        <div className="border-line mt-3 border p-2" data-resume-fiche>
          <p className="font-semibold">Fiche enregistrée :</p>
          <ul className="list-disc pl-5">{fait.resume.map((l, i) => <li key={i}>{l}</li>)}</ul>
          <p className="mt-2 flex flex-wrap gap-4">
            <Link to="/admin/livres/$slug" params={{ slug: fait.slug }} className="underline">Ouvrir la fiche du livre</Link>
            <Link to="/admin/livres/$slug" params={{ slug: fait.slug }} search={{ onglet: "fr" }} className="underline">Aperçu (édition française)</Link>
            <Link to="/admin/livres/$slug" params={{ slug: fait.slug }} search={{ onglet: "en" }} className="underline">Aperçu (édition anglaise)</Link>
          </p>
        </div>
      )}
    </div>
  );
}
