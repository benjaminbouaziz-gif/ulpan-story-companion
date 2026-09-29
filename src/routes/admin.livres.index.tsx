import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminCollectionsChoix, adminLivres, createLivre } from "@/lib/admin-livres.functions";
import { slugDepuisNom, slugProbleme } from "@/lib/slug";
import { ERREURS, messageErreur } from "@/admin/textes";
import { btnCls, btnPrimaryCls, cellCls, EditionPastilles, Field, hebrewStyle, inputCls } from "@/admin/ui";
import { DeposerFiche } from "@/admin/DeposerFiche";

export const Route = createFileRoute("/admin/livres/")({
  component: Livres,
});

function Couverture({ url }: { url: string | null }) {
  return url ? (
    <img src={url} alt="" className="border-line h-12 w-9 border object-cover" />
  ) : (
    <span className="border-line inline-block h-12 w-9 border border-dashed" />
  );
}

function Livres() {
  const list = useServerFn(adminLivres);
  const q = useQuery({ queryKey: ["admin", "livres"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [depot, setDepot] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-[26px]">Livres</h1>
        <button type="button" className={`${btnCls} ml-auto`} onClick={() => setDepot((v) => !v)}>
          Déposer une fiche livre (JSON)
        </button>
        <button type="button" className={btnCls} onClick={() => setOpen((v) => !v)}>
          Nouveau livre
        </button>
      </div>
      {depot && <DeposerFiche onDone={() => void q.refetch()} />}
      {open && <NouveauLivre />}
      {q.isLoading ? (
        <p className="mt-6">…</p>
      ) : q.error ? (
        <p className="mt-6">{messageErreur(q.error)}</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-secondary-text mt-6">Aucun livre pour l'instant.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={cellCls}>Couvertures</th>
                <th className={cellCls}>Slug</th>
                <th className={cellCls}>Collection</th>
                <th className={cellCls}>Tome</th>
                <th className={cellCls}>Éditions</th>
                <th className={cellCls}>Pages</th>
                <th className={cellCls}>Avec audio</th>
              </tr>
            </thead>
            <tbody>
              {q.data!.map((b) => (
                <tr key={b.id}>
                  <td className={cellCls}>
                    <span className="flex gap-1">
                      <Couverture url={b.coverFr} />
                      <Couverture url={b.coverEn} />
                    </span>
                  </td>
                  <td className={cellCls}>
                    <Link to="/admin/livres/$slug" params={{ slug: b.slug }} className="underline">
                      {b.slug}
                    </Link>
                  </td>
                  <td className={cellCls}>{b.collection ?? "—"}</td>
                  <td className={cellCls}>{b.tomeNo ?? "—"}</td>
                  <td className={cellCls}><EditionPastilles editions={b.editions} /></td>
                  <td className={cellCls}>{b.pages}</td>
                  <td className={cellCls}>{b.pagesAudio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NouveauLivre() {
  const navigate = useNavigate();
  const create = useServerFn(createLivre);
  const colsFn = useServerFn(adminCollectionsChoix);
  const cols = useQuery({ queryKey: ["admin", "collections-choix"], queryFn: () => colsFn() });
  const [titreFr, setTitreFr] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouche, setSlugTouche] = useState(false);
  const [collectionId, setCollectionId] = useState("");
  const [tome, setTome] = useState("");
  const [titleHe, setTitleHe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = slugProbleme(slug.trim());
    if (p) return setError(ERREURS[p]!);
    setBusy(true);
    setError(null);
    try {
      const r = await create({
        data: { slug: slug.trim(), collectionId: collectionId || null, tomeNo: tome ? Number(tome) : null, titleHe: titleHe || null },
      });
      navigate({ to: "/admin/livres/$slug", params: { slug: r.slug } });
    } catch (err) {
      setError(messageErreur(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-line mt-4 grid max-w-[640px] gap-3 border p-4 sm:grid-cols-2">
      <Field label="Titre (français)">
        <input className={inputCls} value={titreFr} placeholder="Notre homme à Damas" onChange={(e) => { setTitreFr(e.target.value); if (!slugTouche) setSlug(slugDepuisNom(e.target.value)); }} />
      </Field>
      <Field label="Slug">
        <input className={inputCls} value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouche(true); }} placeholder="eli-cohen" />
        <span className="text-secondary-text mt-1 block text-[12px]">C'est l'adresse web : oulpanstory.fr/livres/{slug || "eli-cohen"}. Minuscules, chiffres et tirets. Le nom affiché se règle ensuite en français et en anglais.</span>
      </Field>
      <Field label="Collection">
        <select className={inputCls} value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
          <option value="">Aucune pour l'instant</option>
          {(cols.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name ?? c.slug}</option>
          ))}
        </select>
      </Field>
      <Field label="Tome">
        <input className={inputCls} type="number" min={0} value={tome} onChange={(e) => setTome(e.target.value)} />
      </Field>
      <Field label="Titre hébreu">
        <input className={inputCls} dir="rtl" lang="he" style={hebrewStyle} value={titleHe} onChange={(e) => setTitleHe(e.target.value)} />
      </Field>
      <p className="text-secondary-text text-[12px] sm:col-span-2">Une collection sera exigée pour publier.</p>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className={btnPrimaryCls} disabled={busy}>{busy ? "…" : "Créer le livre"}</button>
        {error && <span className="text-[13px]">{error}</span>}
      </div>
    </form>
  );
}
