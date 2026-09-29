import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addBlock, blockHistory, listBlocks, removeBlock, removeBlockImage, restoreVersion, saveBlocks, uploadBlockImage } from "@/lib/admin-site.functions";
import { KIND_LABELS, type BlockKind, type PageKey } from "@/lib/site-blocks";
import { messageErreur } from "@/admin/textes";
import { btnCls, btnPrimaryCls, Field, inputCls } from "@/admin/ui";

type Lang = "fr" | "en";
export type BlockTarget =
  | { scope: "site"; pageKey: PageKey; lang: Lang }
  | { scope: "collection"; collectionId: string; lang: Lang };
type Row = Awaited<ReturnType<typeof listBlocks>>[number];
type Item = Record<string, string>;

const ITEM_FIELDS: Partial<Record<BlockKind, { key: string; label: string; long?: boolean }[]>> = {
  etapes: [{ key: "numero", label: "Numéro" }, { key: "titre", label: "Titre" }, { key: "texte", label: "Texte", long: true }],
  faq: [{ key: "question", label: "Question" }, { key: "reponse", label: "Réponse", long: true }],
  chiffres: [{ key: "valeur", label: "Valeur" }, { key: "libelle", label: "Libellé" }],
};

const dateFr = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** L'éditeur de blocs, unique, réutilisé pour les pages du site et les collections. */
export function BlockEditor({ target, kinds }: { target: BlockTarget; kinds: readonly BlockKind[] }) {
  const list = useServerFn(listBlocks);
  const save = useServerFn(saveBlocks);
  const add = useServerFn(addBlock);
  const rm = useServerFn(removeBlock);
  const qc = useQueryClient();
  const key = ["admin", "blocks", target];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: target }) });
  const [rows, setRows] = useState<Row[]>([]);
  const [base, setBase] = useState("[]");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [newKind, setNewKind] = useState<BlockKind>(kinds[0]!);

  useEffect(() => {
    if (!q.data) return;
    setRows(q.data);
    setBase(JSON.stringify(q.data));
  }, [q.data]);

  const baseRows: Row[] = JSON.parse(base);
  const changed = rows.filter((r, i) => JSON.stringify(r) !== JSON.stringify(baseRows.find((b) => b.id === r.id)) || baseRows[i]?.id !== r.id);
  const dirty = changed.length > 0;
  const reload = () => qc.invalidateQueries({ queryKey: key });
  const upd = (id: string, p: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const move = (i: number, j: number) => {
    const n = [...rows];
    [n[i], n[j]] = [n[j]!, n[i]!];
    setRows(n.map((r, k) => ({ ...r, sort_order: k + 1 })));
  };

  async function enregistrer() {
    try {
      await save({ data: { target, blocks: changed.map((r) => ({ id: r.id, sort_order: r.sort_order, title: r.title, body: r.body, items: r.items as Item[], is_visible: r.is_visible })) } });
      setMsg("Enregistré.");
      await reload();
    } catch (e) { setMsg(messageErreur(e)); }
  }

  if (q.isLoading) return <p>…</p>;
  if (q.error) return <p>{messageErreur(q.error)}</p>;

  return (
    <div className="max-w-[820px] text-[13px]">
      {rows.length === 0 && <p className="text-secondary-text">Aucun bloc.</p>}
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id} className="border-line border">
            <div className="flex flex-wrap items-center gap-2 px-2 py-1">
              <button type="button" className="flex-1 truncate text-left" onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })}>
                <strong>{KIND_LABELS[r.kind]}</strong> {r.title ? `· ${r.title.slice(0, 60)}` : r.body ? `· ${r.body.slice(0, 60)}` : ""}
                {!r.is_visible && " (masqué)"}
              </button>
              <button type="button" className={btnCls} disabled={i === 0} onClick={() => move(i, i - 1)}>Monter</button>
              <button type="button" className={btnCls} disabled={i === rows.length - 1} onClick={() => move(i, i + 1)}>Descendre</button>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={r.is_visible} onChange={(e) => upd(r.id, { is_visible: e.target.checked })} /> Visible
              </label>
              <button type="button" className={btnCls} onClick={async () => {
                if (!window.confirm("Retirer ce bloc ?")) return;
                try { await rm({ data: { scope: target.scope, id: r.id } }); await reload(); } catch (e) { setMsg(messageErreur(e)); }
              }}>Retirer</button>
              <button type="button" className={btnCls} onClick={() => setOpen({ ...open, [`h-${r.id}`]: !open[`h-${r.id}`] })}>Historique</button>
            </div>
            {open[r.id] && <div className="border-line border-t p-3"><Formulaire r={r} scope={target.scope} upd={(p) => upd(r.id, p)} onImage={reload} /></div>}
            {open[`h-${r.id}`] && <div className="border-line border-t p-3"><Historique scope={target.scope} id={r.id} onRestore={reload} /></div>}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className={`${inputCls} !w-48`} value={newKind} onChange={(e) => setNewKind(e.target.value as BlockKind)}>
          {kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
        <button type="button" className={btnCls} disabled={dirty} title={dirty ? "Enregistrez d'abord" : undefined} onClick={async () => {
          try { const r = await add({ data: { target, kind: newKind } }); await reload(); setOpen({ ...open, [r.id]: true }); } catch (e) { setMsg(messageErreur(e)); }
        }}>Ajouter un bloc</button>
        <span className="ml-auto flex items-center gap-2">
          {dirty ? <span>Modifications non enregistrées</span> : msg && <span>{msg}</span>}
          <button type="button" className={btnPrimaryCls} disabled={!dirty} onClick={() => void enregistrer()}>Enregistrer</button>
        </span>
      </div>
    </div>
  );
}

function Formulaire({ r, scope, upd, onImage }: { r: Row; scope: "site" | "collection"; upd: (p: Partial<Row>) => void; onImage: () => void }) {
  const fields = ITEM_FIELDS[r.kind];
  const items = (r.items as Item[]) ?? [];
  if (r.kind === "titre") return <Field label="Titre"><input className={inputCls} value={r.title ?? ""} onChange={(e) => upd({ title: e.target.value })} /></Field>;
  if (r.kind === "texte")
    return (
      <div className="space-y-2">
        <Field label="Titre (facultatif)"><input className={inputCls} value={r.title ?? ""} onChange={(e) => upd({ title: e.target.value })} /></Field>
        <Field label="Texte (paragraphes séparés par une ligne vide)"><textarea className={`${inputCls} h-40`} value={r.body ?? ""} onChange={(e) => upd({ body: e.target.value })} /></Field>
      </div>
    );
  if (r.kind === "citation")
    return (
      <div className="space-y-2">
        <Field label="Citation"><textarea className={`${inputCls} h-24`} value={r.body ?? ""} onChange={(e) => upd({ body: e.target.value })} /></Field>
        <Field label="Source"><input className={inputCls} value={r.title ?? ""} onChange={(e) => upd({ title: e.target.value })} /></Field>
      </div>
    );
  if (r.kind === "image") return <ImageBloc r={r} scope={scope} upd={upd} onImage={onImage} />;
  if (!fields) return null;
  const setItems = (n: Item[]) => upd({ items: n as Row["items"] });
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="border-line space-y-1 border p-2">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.long
                ? <textarea className={`${inputCls} h-20`} value={it[f.key] ?? ""} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} />
                : <input className={inputCls} value={it[f.key] ?? ""} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} />}
            </Field>
          ))}
          <div className="flex gap-1">
            <button type="button" className={btnCls} disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; setItems(n); }}>Monter</button>
            <button type="button" className={btnCls} disabled={i === items.length - 1} onClick={() => { const n = [...items]; [n[i + 1], n[i]] = [n[i]!, n[i + 1]!]; setItems(n); }}>Descendre</button>
            <button type="button" className={btnCls} onClick={() => setItems(items.filter((_, j) => j !== i))}>Retirer</button>
          </div>
        </div>
      ))}
      <button type="button" className={btnCls} onClick={() => setItems([...items, Object.fromEntries(fields.map((f) => [f.key, ""]))])}>Ajouter</button>
    </div>
  );
}

function ImageBloc({ r, scope, upd, onImage }: { r: Row; scope: "site" | "collection"; upd: (p: Partial<Row>) => void; onImage: () => void }) {
  const up = useServerFn(uploadBlockImage);
  const rmImg = useServerFn(removeBlockImage);
  const ref = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function deposer(f: File | undefined) {
    if (!f) return;
    if (!/\.(png|jpe?g|webp)$/i.test(f.name)) return setMsg("Formats acceptés : PNG, JPG, WebP.");
    if (f.size > 10 * 1024 * 1024) return setMsg("Image trop lourde (10 Mo au plus).");
    const body = new FormData();
    body.set("scope", scope);
    body.set("id", r.id);
    body.set("file", f);
    try { await up({ data: body }); setMsg(null); onImage(); } catch (e) { setMsg(messageErreur(e)); }
  }
  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void deposer(e.target.files?.[0]); e.target.value = ""; }} />
      {r.imageUrl ? <img src={r.imageUrl} alt={r.title ?? ""} className="border-line max-h-56 border" /> : <p className="text-secondary-text">Aucune image.</p>}
      <button type="button" className={btnCls} onClick={() => ref.current?.click()}>{r.imageUrl ? "Remplacer" : "Déposer une image"}</button>
      {r.imageUrl && <button type="button" className={`${btnCls} ml-2`} onClick={async () => {
        if (!window.confirm("Retirer cette image ?")) return;
        try { await rmImg({ data: { scope, id: r.id } }); onImage(); } catch (e) { setMsg(messageErreur(e)); }
      }}>Retirer l'image</button>}
      {msg && <p>{msg}</p>}
      <Field label="Légende"><input className={inputCls} value={r.title ?? ""} onChange={(e) => upd({ title: e.target.value })} /></Field>
    </div>
  );
}

function Historique({ scope, id, onRestore }: { scope: "site" | "collection"; id: string; onRestore: () => void }) {
  const hist = useServerFn(blockHistory);
  const restore = useServerFn(restoreVersion);
  const q = useQuery({ queryKey: ["admin", "block-history", id], queryFn: () => hist({ data: { scope, id } }) });
  const qc = useQueryClient();
  if (q.isLoading) return <p>…</p>;
  if (!q.data?.length) return <p className="text-secondary-text">Aucune version.</p>;
  return (
    <ul className="space-y-1">
      {q.data.map((v) => (
        <li key={v.id} className="flex flex-wrap items-center gap-2">
          <span>{dateFr(v.createdAt)} · {v.auteur} · {v.extrait || "—"}</span>
          <button type="button" className={btnCls} onClick={async () => {
            if (!window.confirm("Revenir à cette version ?")) return;
            await restore({ data: { scope, versionId: v.id } });
            await qc.invalidateQueries({ queryKey: ["admin", "block-history", id] });
            onRestore();
          }}>Revenir à cette version</button>
        </li>
      ))}
    </ul>
  );
}
