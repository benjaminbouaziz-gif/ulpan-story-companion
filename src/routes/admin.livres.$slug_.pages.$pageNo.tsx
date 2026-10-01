import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  adminPage,
  removePageAudio,
  savePageParagraphs,
  setPagePublished,
  uploadPageAudio,
} from "@/lib/admin-livres.functions";
import { extensionAudio } from "@/lib/slug";
import { messageErreur } from "@/admin/textes";
import { btnCls, btnPrimaryCls, hebrewStyle, inputCls, Section } from "@/admin/ui";
import { EcouterAudio } from "@/admin/EcouterAudio";

export const Route = createFileRoute("/admin/livres/$slug_/pages/$pageNo")({
  component: PageEcran,
});

type Para = { kind: "narration" | "dialogue"; heNikud: string; hePlain: string };

function PageEcran() {
  const { slug, pageNo } = Route.useParams();
  const n = Number(pageNo);
  const fetchPage = useServerFn(adminPage);
  const q = useQuery({ queryKey: ["admin", "page", slug, n], queryFn: () => fetchPage({ data: { slug, pageNo: n } }) });
  const qc = useQueryClient();
  const save = useServerFn(savePageParagraphs);
  const setPub = useServerFn(setPagePublished);
  const upload = useServerFn(uploadPageAudio);
  const remove = useServerFn(removePageAudio);
  const fileRef = useRef<HTMLInputElement>(null);
  const [paras, setParas] = useState<Para[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [audioMsg, setAudioMsg] = useState<string | null>(null);

  const [pubMsg, setPubMsg] = useState<string | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const dirty = base !== null && JSON.stringify(paras) !== base;
  useEffect(() => {
    if (!q.data) return;
    if (loadedId !== q.data.page.id || !dirty) {
      setParas(q.data.paragraphs);
      setBase(JSON.stringify(q.data.paragraphs));
      setLoadedId(q.data.page.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "page", slug, n] });
    void qc.invalidateQueries({ queryKey: ["admin", "livre", slug] });
  };

  if (q.isLoading) return <p>…</p>;
  if (q.error || !q.data) return <p>{messageErreur(q.error)}</p>;
  const d = q.data;

  const setParasM = (v: Para[]) => { setMsg(null); setParas(v); };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= paras.length) return;
    const c = [...paras];
    [c[i], c[j]] = [c[j]!, c[i]!];
    setParas(c);
  };
  const upd = (i: number, patch: Partial<Para>) => setParasM(paras.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  async function envoyerAudio() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!extensionAudio(file.name)) return setAudioMsg("Seuls les fichiers .mp3 et .m4a sont acceptés.");
    if (d.page.hasAudio && !window.confirm("Remplacer l'audio existant ?")) return;
    try {
      const body = new FormData();
      body.set("pageId", d.page.id);
      body.set("file", file);
      await upload({ data: body });
      setAudioMsg("Audio enregistré.");
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    } catch (e) {
      setAudioMsg(messageErreur(e));
    }
  }

  return (
    <div>
      <Link to="/admin/livres/$slug" params={{ slug }} search={{ onglet: "pages" }} className="label text-secondary-text">
        ← {d.book.slug} · Pages & audio
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <h1 className="text-[26px]">Page {d.page.pageNo}</h1>
        <span className="text-secondary-text text-[13px]">Chapitre {d.page.chapterNo}</span>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={d.page.isPublished} onChange={async (e) => {
            try { await setPub({ data: { pageId: d.page.id, value: e.target.checked } }); setPubMsg(null); refresh(); } catch (err) { setPubMsg(messageErreur(err)); }
          }} />
          Publiée
        </label>
        {pubMsg && <span className="text-[13px]">{pubMsg}</span>}
        <span className="ml-auto flex gap-3">
          {d.prev !== null && <Link to="/admin/livres/$slug/pages/$pageNo" params={{ slug, pageNo: String(d.prev) }} className={btnCls}>Page précédente</Link>}
          {d.next !== null && <Link to="/admin/livres/$slug/pages/$pageNo" params={{ slug, pageNo: String(d.next) }} className={btnCls}>Page suivante</Link>}
        </span>
      </div>

      <Section title="Paragraphes">
        <div className="space-y-4">
          {paras.map((p, i) => (
            <div key={i} className="border-line border p-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="label">§ {i + 1}</span>
                <select className={`${inputCls} !w-36`} value={p.kind} onChange={(e) => upd(i, { kind: e.target.value as Para["kind"] })}>
                  <option value="narration">Narration</option>
                  <option value="dialogue">Dialogue</option>
                </select>
                <span className="ml-auto flex gap-2">
                  <button type="button" className={btnCls} onClick={() => move(i, -1)} disabled={i === 0}>Monter</button>
                  <button type="button" className={btnCls} onClick={() => move(i, 1)} disabled={i === paras.length - 1}>Descendre</button>
                  <button type="button" className={btnCls} onClick={() => setParas(paras.filter((_, k) => k !== i))}>Retirer</button>
                </span>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <label className="block">
                  <span className="label text-secondary-text">Hébreu vocalisé</span>
                  <textarea className={inputCls} rows={3} dir="rtl" lang="he" style={hebrewStyle} value={p.heNikud} onChange={(e) => upd(i, { heNikud: e.target.value })} />
                </label>
                <label className="block">
                  <span className="label text-secondary-text">Hébreu sans nekoudot</span>
                  <textarea className={inputCls} rows={3} dir="rtl" lang="he" style={hebrewStyle} value={p.hePlain} onChange={(e) => upd(i, { hePlain: e.target.value })} />
                </label>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btnCls} onClick={() => setParas([...paras, { kind: "narration", heNikud: "", hePlain: "" }])}>Ajouter un paragraphe</button>
            <button type="button" className={btnPrimaryCls} onClick={async () => {
              try { await save({ data: { pageId: d.page.id, paragraphs: paras } }); setBase(JSON.stringify(paras)); setMsg("Enregistré."); refresh(); } catch (e) { setMsg(messageErreur(e)); }
            }}>Enregistrer les paragraphes</button>
            {msg && <span className="text-[13px]">{msg}</span>}
            {dirty && <span className="text-[13px]">Modifications non enregistrées</span>}
          </div>
        </div>
      </Section>

      <Section title="Audio">
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          {d.page.hasAudio ? <EcouterAudio key={d.page.id} pageId={d.page.id} /> : <span>Aucun audio.</span>}
          <input ref={fileRef} type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4" />
          <button type="button" className={btnCls} onClick={() => void envoyerAudio()}>{d.page.hasAudio ? "Remplacer" : "Déposer"}</button>
          {d.page.hasAudio && (
            <button type="button" className={btnCls} onClick={async () => {
              if (!window.confirm("Retirer l'audio de cette page ?")) return;
              try { await remove({ data: { pageId: d.page.id } }); setAudioMsg("Audio retiré."); refresh(); } catch (e) { setAudioMsg(messageErreur(e)); }
            }}>Retirer</button>
          )}
          {audioMsg && <span>{audioMsg}</span>}
        </div>
      </Section>
    </div>
  );
}
