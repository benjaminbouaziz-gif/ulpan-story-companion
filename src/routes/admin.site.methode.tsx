import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { methodSteps, removeMethodImage, saveMethodLabels, uploadMethodImage } from "@/lib/admin-site.functions";
import { KINDS_BY_PAGE } from "@/lib/site-blocks";
import { BlockEditor } from "@/admin/BlockEditor";
import { LangTabs } from "@/admin/LangTabs";
import { messageErreur } from "@/admin/textes";
import { btnCls, btnPrimaryCls, Field, inputCls, Section } from "@/admin/ui";

export const Route = createFileRoute("/admin/site/methode")({ component: Methode });

function Methode() {
  return (
    <div>
      <Link to="/admin/site" className="label text-secondary-text">← Site</Link>
      <h1 className="mt-2 text-[26px]">Méthode</h1>
      <LangTabs>
        {(lang) => (
          <>
            <Section title="Les 4 étapes en images"><Etapes lang={lang} /></Section>
            <Section title="Texte de la page">
              <BlockEditor target={{ scope: "site", pageKey: "methode", lang }} kinds={KINDS_BY_PAGE.methode} />
            </Section>
          </>
        )}
      </LangTabs>
    </div>
  );
}

function Etapes({ lang }: { lang: "fr" | "en" }) {
  const read = useServerFn(methodSteps);
  const saveLabels = useServerFn(saveMethodLabels);
  const qc = useQueryClient();
  const key = ["admin", "method-steps", lang];
  const q = useQuery({ queryKey: key, queryFn: () => read({ data: { lang } }) });
  const [labels, setLabels] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (q.data) setLabels(q.data.map((s) => s.tabLabel)); }, [q.data]);
  if (q.isLoading || !q.data) return <p>…</p>;
  const dirty = q.data.some((s, i) => s.tabLabel !== labels[i]);
  const reload = () => qc.invalidateQueries({ queryKey: key });
  return (
    <div className="text-[13px]">
      <div className="grid gap-4 sm:grid-cols-2">
        {q.data.map((s, i) => (
          <div key={s.stepNo} className="border-line border p-3">
            <p className="label">Étape {s.stepNo}</p>
            <Field label="Nom de l'onglet"><input className={inputCls} value={labels[i] ?? ""} onChange={(e) => setLabels(labels.map((l, j) => (j === i ? e.target.value : l)))} /></Field>
            <ImageEtape lang={lang} stepNo={s.stepNo} url={s.imageUrl} onDone={reload} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={btnPrimaryCls} disabled={!dirty} onClick={async () => {
          try { await saveLabels({ data: { lang, labels: labels.map((l, i) => ({ stepNo: i + 1, tabLabel: l })) } }); setMsg("Enregistré."); await reload(); } catch (e) { setMsg(messageErreur(e)); }
        }}>Enregistrer les noms</button>
        {dirty ? <span>Modifications non enregistrées</span> : msg && <span>{msg}</span>}
      </div>
    </div>
  );
}

function ImageEtape({ lang, stepNo, url, onDone }: { lang: "fr" | "en"; stepNo: number; url: string | null; onDone: () => void }) {
  const up = useServerFn(uploadMethodImage);
  const rm = useServerFn(removeMethodImage);
  const ref = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function deposer(f: File | undefined) {
    if (!f) return;
    if (!/\.(png|jpe?g|webp)$/i.test(f.name)) return setMsg("Formats acceptés : PNG, JPG, WebP.");
    if (f.size > 10 * 1024 * 1024) return setMsg("Image trop lourde (10 Mo au plus).");
    const body = new FormData();
    body.set("lang", lang);
    body.set("stepNo", String(stepNo));
    body.set("file", f);
    try { await up({ data: body }); setMsg(null); onDone(); } catch (e) { setMsg(messageErreur(e)); }
  }
  return (
    <div className="mt-2 space-y-2">
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void deposer(e.target.files?.[0]); e.target.value = ""; }} />
      {url ? <img src={url} alt={`Étape ${stepNo}`} className="border-line max-h-40 border" /> : <p className="text-secondary-text">Aucune image.</p>}
      <div className="flex gap-2">
        <button type="button" className={btnCls} onClick={() => ref.current?.click()}>{url ? "Remplacer" : "Déposer une image"}</button>
        {url && <button type="button" className={btnCls} onClick={async () => {
          if (!window.confirm("Retirer cette image ?")) return;
          try { await rm({ data: { lang, stepNo } }); onDone(); } catch (e) { setMsg(messageErreur(e)); }
        }}>Retirer</button>}
      </div>
      {msg && <p>{msg}</p>}
    </div>
  );
}
