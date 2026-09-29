import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminCollection, deleteCollection, saveCollection, saveCollectionTexts } from "@/lib/admin-site.functions";
import { COLLECTION_KINDS } from "@/lib/site-blocks";
import { slugProbleme } from "@/lib/slug";
import { Bandeau } from "@/components/Bandeau";
import { BlockEditor } from "@/admin/BlockEditor";
import { LangTabs } from "@/admin/LangTabs";
import { Apercu } from "@/admin/Apercu";
import { ERREURS, messageErreur } from "@/admin/textes";
import { btnCls, btnPrimaryCls, cellCls, EditionPastilles, Field, inputCls, Section } from "@/admin/ui";

export const Route = createFileRoute("/admin/collections/$slug")({ component: Fiche });

/** Nuancier de 12 couleurs sobres (outil d'admin, pas de contenu public). */
const NUANCIER = ["#1f3a5f", "#2e5e4e", "#6b2d2d", "#7a5c2e", "#4a3b5c", "#2f4f4f", "#8c4a2f", "#3d5a80", "#5c6b3a", "#6d4c41", "#34495e", "#7b3f61"];

type Data = Awaited<ReturnType<typeof adminCollection>>;

function Fiche() {
  const { slug } = Route.useParams();
  const read = useServerFn(adminCollection);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "collection", slug], queryFn: () => read({ data: { slug } }) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "collection", slug] });
    void qc.invalidateQueries({ queryKey: ["admin", "collections"] });
  };
  if (q.isLoading) return <p>…</p>;
  if (q.error || !q.data) return <p>{messageErreur(q.error)}</p>;
  const d = q.data;
  return (
    <div>
      <Link to="/admin/collections" className="label text-secondary-text">← Collections</Link>
      <h1 className="mt-2 text-[26px]">{d.texts.fr.name || d.collection.slug}</h1>
      <Commun key={JSON.stringify(d.collection)} d={d} refresh={refresh} />
      <LangTabs>
        {(lang) => (
          <div>
            <Apercu cible={{ kind: "collection", collectionId: d.collection.id }} lang={lang} />
            <Textes d={d} lang={lang} refresh={refresh} />
            <Section title="Présentation enrichie">
              <BlockEditor target={{ scope: "collection", collectionId: d.collection.id, lang }} kinds={COLLECTION_KINDS} />
            </Section>
          </div>
        )}
      </LangTabs>
      <Section title="Les tomes">
        {d.tomes.length === 0 ? <p className="text-secondary-text text-[13px]">Aucun livre dans cette collection.</p> : (
          <table className="w-full border-collapse text-[13px]">
            <thead><tr><th className={cellCls}>Tome</th><th className={cellCls}>Slug</th><th className={cellCls}>Éditions</th></tr></thead>
            <tbody>
              {d.tomes.map((t) => (
                <tr key={t.slug}>
                  <td className={cellCls}>{t.tomeNo ?? "—"}</td>
                  <td className={cellCls}><Link to="/admin/livres/$slug" params={{ slug: t.slug }} className="underline">{t.slug}</Link></td>
                  <td className={cellCls}><EditionPastilles editions={t.editions} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Supprimer d={d} />
    </div>
  );
}

function Commun({ d, refresh }: { d: Data; refresh: () => void }) {
  const save = useServerFn(saveCollection);
  const navigate = useNavigate();
  const [f, setF] = useState({ slug: d.collection.slug, color: d.collection.color, sortOrder: String(d.collection.sortOrder), isVisible: d.collection.isVisible });
  const [msg, setMsg] = useState<string | null>(null);
  const colorOk = /^#[0-9a-fA-F]{6}$/.test(f.color);
  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    const s = f.slug.trim();
    if (s !== d.collection.slug) { const p = slugProbleme(s); if (p) return setMsg(ERREURS[p]!); }
    if (!colorOk) return setMsg("Couleur : format #rrggbb.");
    try {
      const r = await save({ data: { id: d.collection.id, slug: s, color: f.color, sortOrder: Number(f.sortOrder) || 0, isVisible: f.isVisible } });
      setMsg("Enregistré.");
      refresh();
      if (r.slug !== d.collection.slug) navigate({ to: "/admin/collections/$slug", params: { slug: r.slug }, replace: true });
    } catch (err) { setMsg(messageErreur(err)); }
  }
  return (
    <form onSubmit={enregistrer} className="mt-4 grid max-w-[640px] gap-3 text-[13px]">
      <Field label="Slug">
        <input className={inputCls} value={f.slug} disabled={d.collection.slugLocked} onChange={(e) => setF({ ...f, slug: e.target.value })} />
        {d.collection.slugLocked && <span className="mt-1 block text-[12px]">Un livre de la collection a une édition publiée : le slug ne change plus.</span>}
      </Field>
      <Field label="Couleur">
        <span className="flex items-center gap-2">
          <input className={`${inputCls} !w-32`} value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
          {NUANCIER.map((c) => (
            <button key={c} type="button" aria-label={c} className="border-line h-6 w-6 border" style={{ backgroundColor: c }} onClick={() => setF({ ...f, color: c })} />
          ))}
        </span>
      </Field>
      {colorOk && <Bandeau color={f.color}>{f.slug}</Bandeau>}
      <Field label="Ordre d'affichage"><input className={`${inputCls} !w-24`} type="number" min={0} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={f.isVisible} onChange={(e) => setF({ ...f, isVisible: e.target.checked })} /> Visible
      </label>
      <p className="text-secondary-text">Masquée, la collection et ses livres n'apparaissent nulle part sur le site, même publiés.</p>
      <div className="flex items-center gap-3">
        <button type="submit" className={btnPrimaryCls}>Enregistrer</button>
        {msg && <span>{msg}</span>}
      </div>
    </form>
  );
}

function Textes({ d, lang, refresh }: { d: Data; lang: "fr" | "en"; refresh: () => void }) {
  const save = useServerFn(saveCollectionTexts);
  const [f, setF] = useState(d.texts[lang]);
  const [base, setBase] = useState(JSON.stringify(d.texts[lang]));
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = JSON.stringify(f) !== base;
  return (
    <div className="grid max-w-[760px] gap-3 text-[13px]">
      <Field label="Nom"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Accroche"><input className={inputCls} value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
      <Field label="Description"><textarea className={`${inputCls} h-32`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="À qui elle s'adresse"><textarea className={`${inputCls} h-24`} value={f.forWhom} onChange={(e) => setF({ ...f, forWhom: e.target.value })} /></Field>
      <div className="flex items-center gap-3">
        <button type="button" className={btnPrimaryCls} onClick={async () => {
          try { await save({ data: { id: d.collection.id, lang, ...f } }); setBase(JSON.stringify(f)); setMsg("Enregistré."); refresh(); } catch (e) { setMsg(messageErreur(e)); }
        }}>Enregistrer</button>
        {dirty ? <span>Modifications non enregistrées</span> : msg && <span>{msg}</span>}
      </div>
    </div>
  );
}

function Supprimer({ d }: { d: Data }) {
  const del = useServerFn(deleteCollection);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [c, setC] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Section title="Supprimer la collection">
      {d.tomes.length > 0 ? <p className="text-secondary-text text-[13px]">Impossible : la collection contient des livres.</p> : (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <input className={`${inputCls} !w-56`} placeholder="Saisir le slug pour confirmer" value={c} onChange={(e) => setC(e.target.value)} />
          <button type="button" className={btnCls} disabled={c !== d.collection.slug} onClick={async () => {
            try { await del({ data: { id: d.collection.id, confirmSlug: c } }); await qc.invalidateQueries({ queryKey: ["admin", "collections"] }); navigate({ to: "/admin/collections" }); } catch (e) { setMsg(messageErreur(e)); }
          }}>Supprimer la collection</button>
          {msg && <span>{msg}</span>}
        </div>
      )}
    </Section>
  );
}
