import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  addEdition,
  adminCollectionsChoix,
  adminLivre,
  deleteEdition,
  deleteLivre,
  saveChapterTitles,
  saveLivre,
  setAllPagesPublished,
  setPagePublished,
} from "@/lib/admin-livres.functions";
import { slugProbleme } from "@/lib/slug";
import { ERREURS, messageErreur } from "@/admin/textes";
import { btnCls, btnPrimaryCls, cellCls, EditionPastilles, Field, hebrewStyle, inputCls, Section } from "@/admin/ui";
import { CollerHebreu } from "@/admin/CollerHebreu";
import { DeposerAudios } from "@/admin/DeposerAudios";
import { EcouterAudio } from "@/admin/EcouterAudio";
import { OngletEdition } from "@/admin/OngletEdition";

const ONGLETS = ["livre", "pages", "fr", "en"] as const;
type Onglet = (typeof ONGLETS)[number];

export const Route = createFileRoute("/admin/livres/$slug")({
  validateSearch: z.object({ onglet: z.enum(ONGLETS).optional() }),
  component: Fiche,
});

type Data = Awaited<ReturnType<typeof adminLivre>>;

function Fiche() {
  const { slug } = Route.useParams();
  const { onglet = "livre" } = Route.useSearch();
  const fetchLivre = useServerFn(adminLivre);
  const q = useQuery({ queryKey: ["admin", "livre", slug], queryFn: () => fetchLivre({ data: { slug } }) });
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "livre", slug] });
    void qc.invalidateQueries({ queryKey: ["admin", "livres"] });
  };

  if (q.isLoading) return <p>…</p>;
  if (q.error || !q.data) return <p>{messageErreur(q.error)}</p>;
  const d = q.data;
  const labels: Record<Onglet, string> = { livre: "Livre", pages: "Pages & audio", fr: "Français", en: "English" };

  return (
    <div>
      <Link to="/admin/livres" className="label text-secondary-text">← Livres</Link>
      <header className="mt-2">
        <h1 className="text-[28px]" dir="rtl" lang="he" style={{ ...hebrewStyle, fontSize: "28px" }}>
          {d.book.titleHe || d.book.slug}
        </h1>
        <p className="text-secondary-text mt-1 flex flex-wrap items-center gap-3 text-[13px]">
          <span>{d.book.slug}</span>
          <span>Tome {d.book.tomeNo ?? "—"}</span>
          <EditionPastilles editions={d.editions} />
        </p>
      </header>
      <nav className="border-line mt-4 flex gap-5 border-b">
        {ONGLETS.map((o) => (
          <Link
            key={o}
            to="/admin/livres/$slug"
            params={{ slug }}
            search={{ onglet: o }}
            className={`label border-b-2 py-2 ${onglet === o ? "border-current" : "border-transparent"}`}
          >
            {labels[o]}
          </Link>
        ))}
      </nav>
      <div className="mt-4">
        {onglet === "livre" && <OngletLivre d={d} refresh={refresh} />}
        {onglet === "pages" && <OngletPages d={d} refresh={refresh} />}
        {(onglet === "fr" || onglet === "en") && (
          <OngletEdition
            key={onglet}
            bookId={d.book.id}
            lang={onglet}
            editionId={d.editions.find((e) => e.lang === onglet)?.id ?? null}
            refreshFiche={refresh}
          />
        )}
      </div>
    </div>
  );
}

function OngletLivre({ d, refresh }: { d: Data; refresh: () => void }) {
  const navigate = useNavigate();
  const save = useServerFn(saveLivre);
  const saveTitles = useServerFn(saveChapterTitles);
  const add = useServerFn(addEdition);
  const delEd = useServerFn(deleteEdition);
  const delBook = useServerFn(deleteLivre);
  const colsFn = useServerFn(adminCollectionsChoix);
  const cols = useQuery({ queryKey: ["admin", "collections-choix"], queryFn: () => colsFn() });

  const [f, setF] = useState({
    slug: d.book.slug,
    collectionId: d.book.collectionId ?? "",
    tome: d.book.tomeNo?.toString() ?? "",
    titleHe: d.book.titleHe ?? "",
    chapters: d.book.chaptersCount?.toString() ?? "",
    vocab: d.book.vocabCount?.toString() ?? "",
  });
  const [titles, setTitles] = useState(d.chapters);
  useEffect(() => setTitles(d.chapters), [d.chapters]);
  const [msg, setMsg] = useState<string | null>(null);
  const [titlesMsg, setTitlesMsg] = useState<string | null>(null);
  const [edMsg, setEdMsg] = useState<string | null>(null);
  const [confirmEd, setConfirmEd] = useState<Record<string, string>>({});
  const [confirmBook, setConfirmBook] = useState("");
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    const p = f.slug !== d.book.slug ? slugProbleme(f.slug.trim()) : null;
    if (p) return setMsg(ERREURS[p]!);
    try {
      const r = await save({
        data: {
          id: d.book.id,
          slug: f.slug.trim(),
          collectionId: f.collectionId || null,
          tomeNo: num(f.tome),
          titleHe: f.titleHe || null,
          chaptersCount: num(f.chapters),
          vocabCount: num(f.vocab),
        },
      });
      setMsg("Enregistré.");
      refresh();
      if (r.slug !== d.book.slug) navigate({ to: "/admin/livres/$slug", params: { slug: r.slug }, replace: true });
    } catch (err) {
      setMsg(messageErreur(err));
    }
  }

  const published = d.editions.some((e) => e.status === "publiee");
  const canDeleteBook = !published && !d.book.slugLocked;

  return (
    <div>
      <form onSubmit={enregistrer} className="grid max-w-[640px] gap-3 sm:grid-cols-2">
        <Field label="Slug">
          <input className={inputCls} value={f.slug} disabled={d.book.slugLocked} onChange={(e) => setF({ ...f, slug: e.target.value })} />
          {d.book.slugLocked && <span className="mt-1 block text-[12px]">🔒 Adresse imprimée dans un QR : elle ne peut plus changer.</span>}
        </Field>
        <Field label="Collection">
          <select className={inputCls} value={f.collectionId} onChange={(e) => setF({ ...f, collectionId: e.target.value })}>
            <option value="">Aucune pour l'instant</option>
            {(cols.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name ?? c.slug}</option>)}
          </select>
        </Field>
        <Field label="Tome"><input className={inputCls} type="number" min={0} value={f.tome} onChange={(e) => setF({ ...f, tome: e.target.value })} /></Field>
        <Field label="Titre hébreu">
          <input className={inputCls} dir="rtl" lang="he" style={hebrewStyle} value={f.titleHe} onChange={(e) => setF({ ...f, titleHe: e.target.value })} />
        </Field>
        <Field label="Nombre de chapitres"><input className={inputCls} type="number" min={0} value={f.chapters} onChange={(e) => setF({ ...f, chapters: e.target.value })} /></Field>
        <Field label="Mots de vocabulaire"><input className={inputCls} type="number" min={0} value={f.vocab} onChange={(e) => setF({ ...f, vocab: e.target.value })} /></Field>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className={btnPrimaryCls}>Enregistrer</button>
          {msg && <span className="text-[13px]">{msg}</span>}
        </div>
      </form>

      <Section title="Titres hébreux des chapitres">
        {titles.length === 0 ? (
          <p className="text-secondary-text text-[13px]">Aucun chapitre : les chapitres viennent des pages collées.</p>
        ) : (
          <div className="max-w-[640px] space-y-2">
            {titles.map((c, i) => (
              <label key={c.chapterNo} className="flex items-center gap-3">
                <span className="label w-24 shrink-0">Chapitre {c.chapterNo}</span>
                <input
                  className={inputCls}
                  dir="rtl"
                  lang="he"
                  style={hebrewStyle}
                  value={c.titleHe}
                  onChange={(e) => setTitles(titles.map((t, j) => (j === i ? { ...t, titleHe: e.target.value } : t)))}
                />
              </label>
            ))}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={btnPrimaryCls}
                onClick={async () => {
                  try {
                    await saveTitles({ data: { bookId: d.book.id, titles } });
                    setTitlesMsg("Enregistré.");
                    refresh();
                  } catch (e) {
                    setTitlesMsg(messageErreur(e));
                  }
                }}
              >
                Enregistrer les titres
              </button>
              {titlesMsg && <span className="text-[13px]">{titlesMsg}</span>}
            </div>
          </div>
        )}
      </Section>

      <Section title="Éditions">
        <div className="space-y-3">
          {(["fr", "en"] as const).map((lang) => {
            const ed = d.editions.find((e) => e.lang === lang);
            const nom = lang === "fr" ? "française" : "anglaise";
            if (!ed)
              return (
                <button key={lang} type="button" className={btnCls} onClick={async () => {
                  try { await add({ data: { bookId: d.book.id, lang } }); setEdMsg(null); refresh(); } catch (e) { setEdMsg(messageErreur(e)); }
                }}>
                  Ajouter l'édition {nom}
                </button>
              );
            if (ed.status === "publiee") return <p key={lang} className="text-[13px]">Édition {nom} publiée : elle ne se supprime pas.</p>;
            return (
              <div key={lang} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span>Édition {nom} en préparation.</span>
                <input
                  className={`${inputCls} !w-48`}
                  placeholder="Saisir le slug pour confirmer"
                  value={confirmEd[lang] ?? ""}
                  onChange={(e) => setConfirmEd({ ...confirmEd, [lang]: e.target.value })}
                />
                <button type="button" className={btnCls} disabled={confirmEd[lang] !== d.book.slug} onClick={async () => {
                  try { await delEd({ data: { editionId: ed.id, confirmSlug: confirmEd[lang] ?? "" } }); setEdMsg(null); refresh(); } catch (e) { setEdMsg(messageErreur(e)); }
                }}>
                  Supprimer cette édition
                </button>
              </div>
            );
          })}
          {edMsg && <p className="text-[13px]">{edMsg}</p>}
        </div>
      </Section>

      <Section title="Supprimer le livre">
        {canDeleteBook ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <input className={`${inputCls} !w-56`} placeholder="Saisir le slug pour confirmer" value={confirmBook} onChange={(e) => setConfirmBook(e.target.value)} />
            <button type="button" className={btnCls} disabled={confirmBook !== d.book.slug} onClick={async () => {
              try {
                await delBook({ data: { bookId: d.book.id, confirmSlug: confirmBook } });
                refresh();
                navigate({ to: "/admin/livres" });
              } catch (e) {
                setMsg(messageErreur(e));
              }
            }}>
              Supprimer le livre
            </button>
          </div>
        ) : (
          <p className="text-secondary-text text-[13px]">
            {published ? "Impossible : une édition est publiée." : "Impossible : l'adresse est imprimée dans un QR."}
          </p>
        )}
      </Section>
    </div>
  );
}

function OngletPages({ d, refresh }: { d: Data; refresh: () => void }) {
  const setPub = useServerFn(setPagePublished);
  const setAll = useServerFn(setAllPagesPublished);
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [panneau, setPanneau] = useState<"coller" | "audios" | null>(null);

  async function toggle(id: string, value: boolean) {
    setLocal((s) => ({ ...s, [id]: value }));
    try {
      await setPub({ data: { pageId: id, value } });
      setErrs((s) => ({ ...s, [id]: "" }));
      refresh();
    } catch (e) {
      setLocal((s) => ({ ...s, [id]: !value }));
      setErrs((s) => ({ ...s, [id]: messageErreur(e) }));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={btnCls} onClick={() => setPanneau(panneau === "coller" ? null : "coller")}>Coller l'hébreu</button>
        <button type="button" className={btnCls} onClick={() => setPanneau(panneau === "audios" ? null : "audios")}>Déposer des audios</button>
        <span className="ml-auto flex gap-3">
          <button type="button" className={btnCls} disabled={!d.pages.length} onClick={async () => { await setAll({ data: { bookId: d.book.id, value: true } }); setLocal({}); refresh(); }}>Tout publier</button>
          <button type="button" className={btnCls} disabled={!d.pages.length} onClick={async () => { await setAll({ data: { bookId: d.book.id, value: false } }); setLocal({}); refresh(); }}>Tout dépublier</button>
        </span>
      </div>
      {panneau === "coller" && (
        <div className="border-line mt-4 border p-4">
          <CollerHebreu bookId={d.book.id} existantes={d.pages.map((p) => p.pageNo)} onDone={refresh} />
        </div>
      )}
      {panneau === "audios" && (
        <div className="border-line mt-4 border p-4">
          <DeposerAudios pages={d.pages} onDone={refresh} />
        </div>
      )}
      {d.pages.length === 0 ? (
        <p className="text-secondary-text mt-6">Aucune page. Commencez par « Coller l'hébreu ».</p>
      ) : (
        <table className="mt-6 w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={cellCls}>N°</th>
              <th className={cellCls}>Chapitre</th>
              <th className={cellCls}>Paragraphes</th>
              <th className={cellCls}>Audio</th>
              <th className={cellCls}>Publiée</th>
            </tr>
          </thead>
          <tbody>
            {d.pages.map((p) => {
              const pub = local[p.id] ?? p.isPublished;
              return (
                <tr key={p.id}>
                  <td className={cellCls}>
                    <Link to="/admin/livres/$slug/pages/$pageNo" params={{ slug: d.book.slug, pageNo: String(p.pageNo) }} className="underline">{p.pageNo}</Link>
                  </td>
                  <td className={cellCls}>{p.chapterNo}</td>
                  <td className={cellCls}>{p.paragraphs}</td>
                  <td className={cellCls}>
                    <span className="flex items-center gap-2">{p.hasAudio ? "oui" : "non"}{p.hasAudio && <EcouterAudio pageId={p.id} />}</span>
                  </td>
                  <td className={cellCls}>
                    <input type="checkbox" aria-label={`Publier la page ${p.pageNo}`} checked={pub} onChange={(e) => void toggle(p.id, e.target.checked)} />
                    {errs[p.id] ? <span className="ml-2">{errs[p.id]}</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
