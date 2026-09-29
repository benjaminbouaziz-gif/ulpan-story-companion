import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import {
  adminEdition,
  glossaireUrl,
  markQrDownloaded,
  removeEditionImage,
  removeGlossaire,
  saveEditionChapterTitles,
  saveVitrine,
  setEditionStatus,
  uploadEditionImage,
  uploadGlossaire,
} from "@/lib/admin-editions.functions";
import { addEdition } from "@/lib/admin-livres.functions";
import { absoluteUrl, DOMAINS, pathFor } from "@/i18n/routes";
import { messageErreur } from "@/admin/textes";
import { btnCls, btnPrimaryCls, Field, hebrewStyle, inputCls, Section } from "@/admin/ui";
import { EditionQuiz } from "@/admin/EditionQuiz";
import { Apercu } from "@/admin/Apercu";

type Lang = "fr" | "en";
type Data = Awaited<ReturnType<typeof adminEdition>>;

const dateFr = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** Onglets « Français » et « English » : UN composant, paramétré par la langue. */
export function OngletEdition({ bookId, editionId, lang, refreshFiche }: {
  bookId: string;
  editionId: string | null;
  lang: Lang;
  refreshFiche: () => void;
}) {
  const add = useServerFn(addEdition);
  const [err, setErr] = useState<string | null>(null);
  if (!editionId)
    return (
      <div>
        <p>Cette édition n'existe pas.</p>
        <button type="button" className={`${btnCls} mt-2`} onClick={async () => {
          try { await add({ data: { bookId, lang } }); refreshFiche(); } catch (e) { setErr(messageErreur(e)); }
        }}>
          Ajouter l'édition {lang === "fr" ? "française" : "anglaise"}
        </button>
        {err && <p className="mt-2 text-[13px]">{err}</p>}
      </div>
    );
  return <Edition key={editionId} editionId={editionId} refreshFiche={refreshFiche} />;
}

function Edition({ editionId, refreshFiche }: { editionId: string; refreshFiche: () => void }) {
  const read = useServerFn(adminEdition);
  const qc = useQueryClient();
  const key = ["admin", "edition", editionId];
  const q = useQuery({ queryKey: key, queryFn: () => read({ data: { editionId } }) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    refreshFiche();
  };
  if (q.isLoading) return <p>…</p>;
  if (q.error || !q.data) return <p>{messageErreur(q.error)}</p>;
  const d = q.data;
  return (
    <div className="pb-40">
      <Apercu cible={{ kind: "livre", editionId: d.edition.id }} lang={d.edition.lang as Lang} />
      <Section title="1. Vitrine"><Vitrine d={d} refresh={refresh} /></Section>
      <Section title="2. Titres de chapitre"><Titres d={d} refresh={refresh} /></Section>
      <Section title="3. QR"><Qr d={d} refresh={refresh} /></Section>
      <Section title="4. Quiz">
        <EditionQuiz editionId={d.edition.id} slug={d.book.slug} lang={d.edition.lang} pages={d.pages} onChanged={refresh} />
      </Section>
      <Section title="5. Glossaire"><Glossaire d={d} refresh={refresh} /></Section>
      <Publication d={d} refresh={refresh} />
    </div>
  );
}

/* ---------------- 1. Vitrine ---------------- */

function ImageEdition({ d, kind, url, refresh }: { d: Data; kind: "cover" | "excerpt"; url: string | null; refresh: () => void }) {
  const up = useServerFn(uploadEditionImage);
  const rm = useServerFn(removeEditionImage);
  const ref = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function deposer(f: File | undefined) {
    if (!f) return;
    if (!/\.(png|jpe?g|webp)$/i.test(f.name)) return setMsg("Formats acceptés : PNG, JPG, WebP.");
    if (f.size > 10 * 1024 * 1024) return setMsg("Image trop lourde (10 Mo au plus).");
    const body = new FormData();
    body.set("editionId", d.edition.id);
    body.set("kind", kind);
    body.set("file", f);
    try { await up({ data: body }); setMsg(null); refresh(); } catch (e) { setMsg(messageErreur(e)); }
  }
  return (
    <div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void deposer(e.target.files?.[0]); e.target.value = ""; }} />
      {url ? (
        <img src={url} alt={kind === "cover" ? "Couverture" : "Extrait"} className="border-line max-h-64 border" />
      ) : (
        <p className="text-secondary-text text-[13px]">Aucune image.</p>
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" className={btnCls} onClick={() => ref.current?.click()}>{url ? "Remplacer" : "Déposer une image"}</button>
        {url && <button type="button" className={btnCls} onClick={async () => {
          if (!window.confirm("Retirer cette image ?")) return;
          try { await rm({ data: { editionId: d.edition.id, kind } }); refresh(); } catch (e) { setMsg(messageErreur(e)); }
        }}>Retirer</button>}
      </div>
      {msg && <p className="mt-1 text-[13px]">{msg}</p>}
    </div>
  );
}

function Vitrine({ d, refresh }: { d: Data; refresh: () => void }) {
  const save = useServerFn(saveVitrine);
  const init = () => ({
    title: d.edition.title,
    subtitle: d.edition.subtitle,
    blurb: d.edition.blurb,
    levelNote: d.edition.levelNote,
    learnItems: d.edition.learnItems,
    printPageCount: d.edition.printPageCount?.toString() ?? "",
    amazonUrl: d.edition.amazonUrl,
  });
  const [f, setF] = useState(init);
  const [base, setBase] = useState(() => JSON.stringify(init()));
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = JSON.stringify(f) !== base;
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const items = f.learnItems;
  const move = (i: number, j: number) => {
    const n = [...items];
    [n[i], n[j]] = [n[j]!, n[i]!];
    set({ learnItems: n });
  };
  const urlOk = !f.amazonUrl.trim() || /^https:\/\/\S+$/.test(f.amazonUrl.trim());

  async function enregistrer() {
    if (!urlOk) return setMsg("Le lien Amazon doit commencer par https://");
    try {
      await save({
        data: {
          editionId: d.edition.id,
          ...f,
          printPageCount: f.printPageCount.trim() ? Number(f.printPageCount) : null,
        },
      });
      setBase(JSON.stringify(f));
      setMsg("Enregistré.");
      refresh();
    } catch (e) {
      setMsg(e instanceof Error && e.message.includes("AMAZON_URL") ? "Le lien Amazon doit commencer par https://" : messageErreur(e));
    }
  }

  return (
    <div className="grid max-w-[760px] gap-4">
      <Field label="Couverture"><ImageEdition d={d} kind="cover" url={d.edition.coverUrl} refresh={refresh} /></Field>
      <Field label="Titre"><input className={inputCls} value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Sous-titre"><input className={inputCls} value={f.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
      <Field label="Résumé"><textarea className={`${inputCls} h-32`} value={f.blurb} onChange={(e) => set({ blurb: e.target.value })} /></Field>
      <Field label="Note de niveau"><input className={inputCls} value={f.levelNote} onChange={(e) => set({ levelNote: e.target.value })} /></Field>
      <div>
        <span className="label text-secondary-text">Ce que vous apprendrez</span>
        <div className="mt-1 space-y-1">
          {items.map((l, i) => (
            <div key={i} className="flex gap-1">
              <input className={inputCls} value={l} onChange={(e) => set({ learnItems: items.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className={btnCls} disabled={i === 0} onClick={() => move(i, i - 1)}>Monter</button>
              <button type="button" className={btnCls} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>Descendre</button>
              <button type="button" className={btnCls} onClick={() => set({ learnItems: items.filter((_, j) => j !== i) })}>Retirer</button>
            </div>
          ))}
          <button type="button" className={btnCls} onClick={() => set({ learnItems: [...items, ""] })}>Ajouter une ligne</button>
        </div>
      </div>
      <Field label="Nombre de pages du livre imprimé"><input className={`${inputCls} !w-32`} type="number" min={1} value={f.printPageCount} onChange={(e) => set({ printPageCount: e.target.value })} /></Field>
      <Field label="Lien Amazon">
        <span className="flex gap-2">
          <input className={inputCls} value={f.amazonUrl} placeholder="https://…" onChange={(e) => set({ amazonUrl: e.target.value })} />
          <button type="button" className={btnCls} disabled={!f.amazonUrl.trim() || !urlOk} onClick={() => window.open(f.amazonUrl.trim(), "_blank", "noopener")}>Tester le lien</button>
        </span>
        {!urlOk && <span className="mt-1 block text-[12px]">Le lien doit commencer par https://</span>}
      </Field>
      <Field label="Extrait (une vraie double page)"><ImageEdition d={d} kind="excerpt" url={d.edition.excerptUrl} refresh={refresh} /></Field>
      <div className="flex items-center gap-3">
        <button type="button" className={btnPrimaryCls} onClick={() => void enregistrer()}>Enregistrer</button>
        {dirty ? <span className="text-[13px]">Modifications non enregistrées</span> : msg && <span className="text-[13px]">{msg}</span>}
      </div>
    </div>
  );
}

/* ---------------- 2. Titres ---------------- */

function Titres({ d, refresh }: { d: Data; refresh: () => void }) {
  const save = useServerFn(saveEditionChapterTitles);
  const [t, setT] = useState(d.chapitres);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setT(d.chapitres), [d.chapitres]);
  if (!t.length) return <p className="text-secondary-text text-[13px]">Aucun chapitre : ils viennent des pages du livre.</p>;
  return (
    <div className="max-w-[760px] space-y-2">
      {t.map((c, i) => (
        <div key={c.chapterNo} className="flex items-center gap-3">
          <span className="label w-24 shrink-0">Chapitre {c.chapterNo}</span>
          <span className="w-48 shrink-0 truncate" dir="rtl" lang="he" style={{ ...hebrewStyle, fontSize: "16px" }}>{c.titleHe || "—"}</span>
          <input className={inputCls} value={c.title} onChange={(e) => setT(t.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" className={btnPrimaryCls} onClick={async () => {
          try {
            await save({ data: { editionId: d.edition.id, titles: t.map((c) => ({ chapterNo: c.chapterNo, title: c.title })) } });
            setMsg("Enregistré.");
            refresh();
          } catch (e) { setMsg(messageErreur(e)); }
        }}>Enregistrer les titres</button>
        {msg && <span className="text-[13px]">{msg}</span>}
      </div>
    </div>
  );
}

/* ---------------- 3. QR ---------------- */

const QR_OPTS = { errorCorrectionLevel: "M" as const, margin: 4, color: { dark: "#000000", light: "#ffffff" } };

function Qr({ d, refresh }: { d: Data; refresh: () => void }) {
  const mark = useServerFn(markQrDownloaded);
  const url = absoluteUrl("entree_qr", d.edition.lang, { slug: d.book.slug });
  const [svg, setSvg] = useState("");
  const [copie, setCopie] = useState(false);
  useEffect(() => { void QRCode.toString(url, { ...QR_OPTS, type: "svg" }).then(setSvg); }, [url]);
  const nom = `qr-${d.book.slug}-${d.edition.lang}`;

  async function telecharger(kind: "svg" | "png") {
    const href = kind === "svg"
      ? URL.createObjectURL(new Blob([await QRCode.toString(url, { ...QR_OPTS, type: "svg" })], { type: "image/svg+xml" }))
      : await QRCode.toDataURL(url, { ...QR_OPTS, width: 1200 });
    const a = document.createElement("a");
    a.href = href;
    a.download = `${nom}.${kind}`;
    a.click();
    if (kind === "svg") URL.revokeObjectURL(href);
    await mark({ data: { editionId: d.edition.id } });
    refresh();
  }

  return (
    <div className="text-[13px]">
      <p className="flex items-center gap-2">
        <span>Adresse imprimée : <strong>{url}</strong></span>
        <button type="button" className={btnCls} onClick={async () => { await navigator.clipboard.writeText(url); setCopie(true); }}>{copie ? "Copié" : "Copier"}</button>
      </p>
      <div className="mt-3 w-48 bg-background" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="mt-3 flex gap-2">
        <button type="button" className={btnCls} onClick={() => void telecharger("svg")}>Télécharger en SVG</button>
        <button type="button" className={btnCls} onClick={() => void telecharger("png")}>Télécharger en PNG</button>
      </div>
      {d.edition.qrDownloadedAt && <p className="mt-2">Téléchargé le {dateFr(d.edition.qrDownloadedAt)} — le slug est verrouillé.</p>}
    </div>
  );
}

/* ---------------- 5. Glossaire ---------------- */

function taille(n: number | null) {
  if (n == null) return "";
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

function Glossaire({ d, refresh }: { d: Data; refresh: () => void }) {
  const up = useServerFn(uploadGlossaire);
  const rm = useServerFn(removeGlossaire);
  const link = useServerFn(glossaireUrl);
  const ref = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const g = d.glossaire;
  async function deposer(f: File | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) return setMsg("Seuls les fichiers PDF sont acceptés.");
    if (f.size > 20 * 1024 * 1024) return setMsg("Fichier trop lourd (20 Mo au plus).");
    if (g && !window.confirm("Remplacer le glossaire actuel ?")) return;
    const body = new FormData();
    body.set("editionId", d.edition.id);
    body.set("file", f);
    setBusy(true);
    try { await up({ data: body }); setMsg(null); refresh(); } catch (e) { setMsg(messageErreur(e)); } finally { setBusy(false); }
  }
  return (
    <div className="text-[13px]">
      <input ref={ref} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { void deposer(e.target.files?.[0]); e.target.value = ""; }} />
      {g ? (
        <p>{g.name}{g.size != null ? ` · ${taille(g.size)}` : ""}{g.updatedAt ? ` · ${dateFr(g.updatedAt)}` : ""}</p>
      ) : (
        <p className="text-secondary-text">Aucun glossaire.</p>
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" className={btnCls} disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Envoi…" : g ? "Remplacer" : "Déposer un PDF"}</button>
        {g && <button type="button" className={btnCls} onClick={async () => {
          try { const r = await link({ data: { editionId: d.edition.id } }); window.location.href = r.url; } catch (e) { setMsg(messageErreur(e)); }
        }}>Télécharger</button>}
        {g && <button type="button" className={btnCls} onClick={async () => {
          if (!window.confirm("Retirer le glossaire ?")) return;
          try { await rm({ data: { editionId: d.edition.id } }); refresh(); } catch (e) { setMsg(messageErreur(e)); }
        }}>Retirer</button>}
      </div>
      {msg && <p className="mt-1">{msg}</p>}
    </div>
  );
}

/* ---------------- 6. Publication ---------------- */

function lienPublic(id: "livre" | "entree_qr", lang: Lang, slug: string) {
  if (typeof window !== "undefined" && DOMAINS[lang].endsWith(window.location.hostname)) return absoluteUrl(id, lang, { slug });
  return `${pathFor(id, lang, { slug })}?lang=${lang}`;
}

function Publication({ d, refresh }: { d: Data; refresh: () => void }) {
  const setStatus = useServerFn(setEditionStatus);
  const [msg, setMsg] = useState<string | null>(null);
  const c = d.controle;
  const pub = d.edition.status === "publiee";
  async function changer(status: "preparation" | "publiee") {
    try {
      await setStatus({ data: { editionId: d.edition.id, status } });
      setMsg(null);
      refresh();
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setMsg(m.includes("EDITION_BLOCKED") ? `Publication refusée : ${m.split("EDITION_BLOCKED:")[1] ?? ""}` : messageErreur(e));
    }
  }
  return (
    <div className="border-line bg-background fixed inset-x-0 bottom-0 z-20 max-h-[40vh] overflow-auto border-t px-6 py-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-3">
        <strong>{pub && d.edition.publishedAt ? `Publiée le ${dateFr(d.edition.publishedAt)}` : "En préparation"}</strong>
        {!pub && <button type="button" className={btnPrimaryCls} disabled={c.bloquants.length > 0} onClick={() => void changer("publiee")}>Publier</button>}
        {pub && <button type="button" className={btnCls} onClick={() => void changer("preparation")}>Repasser en préparation</button>}
        <a className="underline" href={lienPublic("livre", d.edition.lang, d.book.slug)} target="_blank" rel="noopener">Voir la page du livre</a>
        <a className="underline" href={lienPublic("entree_qr", d.edition.lang, d.book.slug)} target="_blank" rel="noopener">Voir l'entrée QR</a>
        {msg && <span>{msg}</span>}
      </div>
      {c.bloquants.length > 0 && <ul className="mt-2 list-disc pl-5">{c.bloquants.map((b) => <li key={b}>Bloquant : {b}</li>)}</ul>}
      {c.avertissements.length > 0 && <ul className="mt-1 list-disc pl-5 opacity-80">{c.avertissements.map((b) => <li key={b}>Avertissement : {b}</li>)}</ul>}
    </div>
  );
}
