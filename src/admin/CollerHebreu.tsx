import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyserColle } from "@/lib/coller-livre";
import { collerHebreu } from "@/lib/admin-livres.functions";
import { messageErreur, VERDICTS } from "./textes";
import { btnCls, btnPrimaryCls, cellCls, hebrewStyle, inputCls } from "./ui";

/**
 * « Coller l'hébreu » : deux saisies distinctes (vocalisé / sans nekoudot).
 * « Analyser » n'écrit rien ; « Écrire » n'apparaît qu'après une analyse sans
 * erreur, et le serveur refait l'analyse.
 */
export function CollerHebreu({ bookId, existantes, onDone }: { bookId: string; existantes: number[]; onDone: () => void }) {
  const coller = useServerFn(collerHebreu);
  const [nikud, setNikud] = useState("");
  const [plain, setPlain] = useState("");
  const [remplacer, setRemplacer] = useState(false);
  const [analyse, setAnalyse] = useState<ReturnType<typeof analyserColle> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function ecrire() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await coller({ data: { bookId, nikud, plain, remplacer } });
      setMsg(`${r.pages} page(s) et ${r.paragraphs} paragraphe(s) écrits.`);
      setAnalyse(null);
      setNikud("");
      setPlain("");
      onDone();
    } catch (e) {
      setMsg(messageErreur(e));
    } finally {
      setBusy(false);
    }
  }

  const reset = () => setAnalyse(null);

  return (
    <div>
      <p className="max-w-[70ch] text-[13px]">
        Chaque page commence par une ligne-marqueur <span dir="rtl" style={hebrewStyle}>פרק 1 · עמוד 1</span>. Un paragraphe par ligne. Les deux zones sont saisies séparément : rien n'est déduit de l'une à l'autre.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="label text-secondary-text">Hébreu vocalisé</span>
          <textarea className={`${inputCls} mt-1`} rows={14} dir="rtl" lang="he" style={hebrewStyle} value={nikud} onChange={(e) => { setNikud(e.target.value); reset(); }} />
        </label>
        <label className="block">
          <span className="label text-secondary-text">Hébreu sans nekoudot</span>
          <textarea className={`${inputCls} mt-1`} rows={14} dir="rtl" lang="he" style={hebrewStyle} value={plain} onChange={(e) => { setPlain(e.target.value); reset(); }} />
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={remplacer} onChange={(e) => { setRemplacer(e.target.checked); reset(); }} />
        Remplacer les pages qui existent déjà
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={btnCls} onClick={() => { setMsg(null); setAnalyse(analyserColle(nikud, plain, existantes, remplacer)); }}>
          Analyser
        </button>
        {analyse?.ok && (
          <button type="button" className={btnPrimaryCls} disabled={busy} onClick={() => void ecrire()}>
            {busy ? "Écriture…" : "Écrire"}
          </button>
        )}
        {msg && <span className="text-[13px]">{msg}</span>}
      </div>
      {analyse && (
        analyse.lignes.length === 0 ? (
          <p className="mt-3 text-[13px]">Aucun marqueur de page trouvé.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={cellCls}>Page</th>
                <th className={cellCls}>Chapitre</th>
                <th className={cellCls}>Paragraphes vocalisés</th>
                <th className={cellCls}>Paragraphes sans nekoudot</th>
                <th className={cellCls}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {analyse.lignes.map((l) => (
                <tr key={l.pageNo}>
                  <td className={cellCls}>{l.pageNo}</td>
                  <td className={cellCls}>{l.chapterNo ?? "—"}</td>
                  <td className={cellCls}>{l.gauche ?? "—"}</td>
                  <td className={cellCls}>{l.droite ?? "—"}</td>
                  <td className={cellCls}>{VERDICTS[l.verdict]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
