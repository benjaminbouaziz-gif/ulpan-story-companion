import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminChiffres } from "@/lib/admin-lecteurs.functions";
import { messageErreur } from "@/admin/textes";
import { cellCls, Field, inputCls } from "@/admin/ui";

export const Route = createFileRoute("/admin/chiffres")({ component: Chiffres });

const moisDe = (d: Date) => d.toISOString().slice(0, 7);

function Chiffres() {
  const read = useServerFn(adminChiffres);
  const now = new Date();
  const [from, setFrom] = useState(moisDe(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))));
  const [to, setTo] = useState(moisDe(now));
  const r = useQuery({ queryKey: ["admin", "chiffres", from, to], queryFn: () => read({ data: { from, to } }), enabled: /^\d{4}-\d{2}$/.test(from) && /^\d{4}-\d{2}$/.test(to) });
  return (
    <div className="text-[13px]">
      <h1 className="text-[26px]">Chiffres</h1>
      <div className="mt-4 flex max-w-md gap-3">
        <Field label="Du mois"><input type="month" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Au mois"><input type="month" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {r.isLoading ? <p className="mt-4">…</p> : r.error ? <p className="mt-4">{messageErreur(r.error)}</p> : !r.data?.length ? (
        <p className="text-secondary-text mt-4">Aucun événement sur cette période.</p>
      ) : (
        <table className="mt-4 w-full border-collapse">
          <thead><tr>{["Édition", "Mois", "Scans QR", "Demandes d'accès", "Accès validés", "Clics Amazon"].map((h) => <th key={h} className={cellCls}>{h}</th>)}</tr></thead>
          <tbody>{r.data.map((l) => (
            <tr key={l.edition + l.mois}>
              <td className={cellCls}>{l.edition}</td><td className={cellCls}>{l.mois}</td>
              <td className={cellCls}>{l.qr_scan}</td><td className={cellCls}>{l.access_requested}</td><td className={cellCls}>{l.access_confirmed}</td><td className={cellCls}>{l.amazon_click}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}
