import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminDemandesEnAttente, adminExportAttente, adminExportInscrits, adminLecteurDonnees,
  adminLecteursListe, adminListesAttente, adminMarquerPrevenus, adminSupprimerLecteur,
} from "@/lib/admin-lecteurs.functions";
import { messageErreur } from "@/admin/textes";
import { btnCls, cellCls, inputCls } from "@/admin/ui";
import { telecharger } from "@/admin/telecharger";

export const Route = createFileRoute("/admin/lecteurs")({ component: Lecteurs });

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR") : "—");
type Onglet = "lecteurs" | "attente" | "demandes";

function Lecteurs() {
  const [onglet, setOnglet] = useState<Onglet>("lecteurs");
  return (
    <div>
      <h1 className="text-[26px]">Lecteurs</h1>
      <div className="border-line mt-4 flex gap-6 border-b">
        {([["lecteurs", "Lecteurs"], ["attente", "Listes d'attente"], ["demandes", "Demandes en attente"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setOnglet(k)} className={`label border-b-2 py-2 ${onglet === k ? "border-current" : "border-transparent"}`}>{l}</button>
        ))}
      </div>
      <div className="mt-6">
        {onglet === "lecteurs" && <ListeLecteurs />}
        {onglet === "attente" && <Attentes />}
        {onglet === "demandes" && <Demandes />}
      </div>
    </div>
  );
}

function ListeLecteurs() {
  const list = useServerFn(adminLecteursListe);
  const exportInscrits = useServerFn(adminExportInscrits);
  const donnees = useServerFn(adminLecteurDonnees);
  const suppr = useServerFn(adminSupprimerLecteur);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const r = useQuery({ queryKey: ["admin", "lecteurs", q, page], queryFn: () => list({ data: { q, page } }) });
  const pages = Math.max(1, Math.ceil((r.data?.total ?? 0) / 50));
  return (
    <div className="text-[13px]">
      <div className="flex flex-wrap items-center gap-3">
        <input className={`${inputCls} max-w-xs`} placeholder="Rechercher une adresse" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <button type="button" className={`${btnCls} ml-auto`} onClick={async () => { try { telecharger("inscrits-nouveautes.csv", await exportInscrits(), "text/csv;charset=utf-8"); } catch (e) { setMsg(messageErreur(e)); } }}>
          Exporter les inscrits aux nouveautés (CSV)
        </button>
      </div>
      {msg && <p className="mt-2">{msg}</p>}
      {r.isLoading ? <p className="mt-4">…</p> : r.error ? <p className="mt-4">{messageErreur(r.error)}</p> : (
        <>
          <p className="text-secondary-text mt-3">{r.data!.total} lecteur(s)</p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full border-collapse">
              <thead><tr>{["Adresse", "Langue", "Inscrit le", "Dernière visite", "Nouveautés", "Éditions ouvertes", ""].map((h) => <th key={h} className={cellCls}>{h}</th>)}</tr></thead>
              <tbody>
                {r.data!.rows.map((l) => (
                  <tr key={l.userId}>
                    <td className={cellCls}>{l.email}</td>
                    <td className={cellCls}>{l.lang.toUpperCase()}</td>
                    <td className={cellCls}>{date(l.createdAt)}</td>
                    <td className={cellCls}>{date(l.lastSeenAt)}</td>
                    <td className={cellCls}>{l.news === "inscrit" ? "inscrit" : "opposé"}</td>
                    <td className={cellCls}>{l.editions.join(", ") || "—"}</td>
                    <td className={cellCls}>
                      <span className="flex gap-2">
                        <button type="button" className={btnCls} onClick={async () => telecharger(`lecteur-${l.email}.json`, await donnees({ data: { userId: l.userId } }), "application/json")}>Exporter ses données (JSON)</button>
                        <button type="button" className={btnCls} onClick={async () => {
                          if (!window.confirm(`Supprimer définitivement ${l.email} (compte, accès, demandes, liste d'attente, réponses) ?`)) return;
                          try { await suppr({ data: { userId: l.userId } }); setMsg(`${l.email} supprimé.`); await r.refetch(); } catch (e) { setMsg(messageErreur(e)); }
                        }}>Supprimer ce lecteur</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" className={btnCls} disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</button>
            <span>Page {page + 1} / {pages}</span>
            <button type="button" className={btnCls} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Suivant</button>
          </div>
        </>
      )}
    </div>
  );
}

function Attentes() {
  const list = useServerFn(adminListesAttente);
  const exp = useServerFn(adminExportAttente);
  const marquer = useServerFn(adminMarquerPrevenus);
  const r = useQuery({ queryKey: ["admin", "attentes"], queryFn: () => list() });
  if (r.isLoading) return <p>…</p>;
  if (r.error) return <p>{messageErreur(r.error)}</p>;
  if (!r.data!.length) return <p className="text-secondary-text text-[13px]">Aucune adresse en attente.</p>;
  return (
    <div className="space-y-8 text-[13px]">
      {r.data!.map((g) => (
        <section key={g.editionId}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="label">{g.label} — {g.rows.length} adresse(s)</h2>
            <button type="button" className={`${btnCls} ml-auto`} onClick={async () => telecharger(`attente-${g.label.replace(/\W+/g, "-")}.csv`, await exp({ data: { editionId: g.editionId } }), "text/csv;charset=utf-8")}>Exporter (CSV)</button>
            <button type="button" className={btnCls} onClick={async () => { await marquer({ data: { editionId: g.editionId } }); await r.refetch(); }}>Marquer comme prévenus</button>
          </div>
          <table className="mt-2 w-full border-collapse">
            <thead><tr>{["Adresse", "Date", "Nouveautés", "Prévenu le"].map((h) => <th key={h} className={cellCls}>{h}</th>)}</tr></thead>
            <tbody>{g.rows.map((w) => <tr key={w.email}><td className={cellCls}>{w.email}</td><td className={cellCls}>{date(w.createdAt)}</td><td className={cellCls}>{w.news}</td><td className={cellCls}>{date(w.notifiedAt)}</td></tr>)}</tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function Demandes() {
  const list = useServerFn(adminDemandesEnAttente);
  const r = useQuery({ queryKey: ["admin", "demandes"], queryFn: () => list() });
  if (r.isLoading) return <p>…</p>;
  if (r.error) return <p>{messageErreur(r.error)}</p>;
  if (!r.data!.length) return <p className="text-secondary-text text-[13px]">Aucune demande en attente.</p>;
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead><tr>{["Adresse", "Édition", "Date"].map((h) => <th key={h} className={cellCls}>{h}</th>)}</tr></thead>
      <tbody>{r.data!.map((d) => <tr key={d.id}><td className={cellCls}>{d.email}</td><td className={cellCls}>{d.edition}</td><td className={cellCls}>{new Date(d.requestedAt).toLocaleString("fr-FR")}</td></tr>)}</tbody>
    </table>
  );
}
