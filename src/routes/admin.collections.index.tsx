import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminCollections, createCollection } from "@/lib/admin-site.functions";
import { slugDepuisNom, slugProbleme } from "@/lib/slug";
import { ERREURS, messageErreur } from "@/admin/textes";
import { btnCls, btnPrimaryCls, cellCls, inputCls } from "@/admin/ui";

export const Route = createFileRoute("/admin/collections/")({ component: Liste });

function Liste() {
  const list = useServerFn(adminCollections);
  const create = useServerFn(createCollection);
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["admin", "collections"], queryFn: () => list() });
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouche, setSlugTouche] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    const s = slug.trim();
    const p = slugProbleme(s);
    if (p) return setMsg(ERREURS[p]!);
    try {
      const r = await create({ data: { slug: s, nameFr: nom.trim() || undefined } });
      navigate({ to: "/admin/collections/$slug", params: { slug: r.slug } });
    } catch (err) { setMsg(messageErreur(err)); }
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-[26px]">Collections</h1>
        <button type="button" className={btnCls} onClick={() => setOuvert(!ouvert)}>Nouvelle collection</button>
      </div>
      {ouvert && (
        <form onSubmit={creer} className="mt-3 grid max-w-[480px] gap-2 text-[13px]">
          <label className="grid gap-1">Nom (français)
            <input className={inputCls} placeholder="Héros d'Israël" value={nom} onChange={(e) => { setNom(e.target.value); if (!slugTouche) setSlug(slugDepuisNom(e.target.value)); }} />
          </label>
          <label className="grid gap-1">Slug
            <input className={inputCls} placeholder="heros-d-israel" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouche(true); }} />
          </label>
          <p className="text-secondary-text">C'est l'adresse web : oulpanstory.fr/collections/{slug || "heros-d-israel"}. Minuscules, chiffres et tirets. Le nom affiché se règle ensuite en français et en anglais.</p>
          <div className="flex items-center gap-2">
            <button type="submit" className={btnPrimaryCls}>Créer la collection</button>
            {msg && <span>{msg}</span>}
          </div>
        </form>
      )}
      {q.isLoading ? <p className="mt-4">…</p> : q.error ? <p className="mt-4">{messageErreur(q.error)}</p> : !q.data?.length ? (
        <p className="text-secondary-text mt-4">Aucune collection.</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-[13px]">
          <thead>
            <tr>{["", "Slug", "Nom FR", "Nom EN", "État", "Publiées FR", "Publiées EN"].map((h) => <th key={h} className={cellCls}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {q.data.map((c) => (
              <tr key={c.id}>
                <td className={cellCls}><span className="block h-3 w-12" style={{ backgroundColor: c.color }} /></td>
                <td className={cellCls}><Link to="/admin/collections/$slug" params={{ slug: c.slug }} className="underline">{c.slug}</Link></td>
                <td className={cellCls}>{c.nameFr ?? "—"}</td>
                <td className={cellCls}>{c.nameEn ?? "—"}</td>
                <td className={cellCls}>{c.isVisible ? "Visible" : "Masquée"}</td>
                <td className={cellCls}>{c.pubFr}</td>
                <td className={cellCls}>{c.pubEn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
