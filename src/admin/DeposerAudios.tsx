import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { uploadPageAudio } from "@/lib/admin-livres.functions";
import { extensionAudio, pageDepuisNomFichier } from "@/lib/slug";
import { messageErreur } from "./textes";
import { btnCls, btnPrimaryCls, cellCls } from "./ui";

const MAX = 50 * 1024 * 1024;
type Page = { id: string; pageNo: number; hasAudio: boolean };
type Ligne = { file: File; pageNo: number | null; page: Page | null; probleme: string | null; resultat?: string };

/** Dépôt de plusieurs audios : fichier → page d'après le nom, contrôle avant envoi. */
export function DeposerAudios({ pages, onDone }: { pages: Page[]; onDone: () => void }) {
  const upload = useServerFn(uploadPageAudio);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [busy, setBusy] = useState(false);

  function choisir(files: FileList | null) {
    const list = [...(files ?? [])];
    const vus = new Map<number, number>();
    for (const f of list) {
      const n = pageDepuisNomFichier(f.name);
      if (n !== null) vus.set(n, (vus.get(n) ?? 0) + 1);
    }
    setLignes(
      list.map((file) => {
        const pageNo = pageDepuisNomFichier(file.name);
        const page = pageNo === null ? null : pages.find((p) => p.pageNo === pageNo) ?? null;
        let probleme: string | null = null;
        if (!extensionAudio(file.name)) probleme = "Format refusé (.mp3 ou .m4a)";
        else if (file.size > MAX) probleme = "Trop lourd (50 Mo au plus)";
        else if (pageNo === null) probleme = "Aucun numéro de page dans le nom";
        else if (!page) probleme = "Aucune page correspondante";
        else if ((vus.get(pageNo) ?? 0) > 1) probleme = "Plusieurs fichiers pour cette page";
        return { file, pageNo, page, probleme };
      }),
    );
  }

  const valides = lignes.filter((l) => !l.probleme && !l.resultat);

  async function envoyer() {
    setBusy(true);
    const next = [...lignes];
    for (let i = 0; i < next.length; i++) {
      const l = next[i]!;
      if (l.probleme || l.resultat || !l.page) continue;
      try {
        const body = new FormData();
        body.set("pageId", l.page.id);
        body.set("file", l.file);
        await upload({ data: body });
        next[i] = { ...l, resultat: "Envoyé" };
      } catch (e) {
        next[i] = { ...l, resultat: messageErreur(e) };
      }
      setLignes([...next]);
    }
    setBusy(false);
    onDone();
  }

  return (
    <div>
      <p className="text-[13px]">Le numéro de page est lu dans le nom du fichier : page-07.mp3, 07.m4a, p7.mp3, Page 7.mp3.</p>
      <input type="file" multiple accept=".mp3,.m4a,audio/mpeg,audio/mp4" className="mt-2 text-[13px]" onChange={(e) => choisir(e.target.files)} />
      {lignes.length > 0 && (
        <>
          <table className="mt-3 w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={cellCls}>Fichier</th>
                <th className={cellCls}>Page</th>
                <th className={cellCls}>Contrôle</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i}>
                  <td className={cellCls}>{l.file.name}</td>
                  <td className={cellCls}>{l.pageNo ?? "—"}</td>
                  <td className={cellCls}>
                    {l.resultat ?? l.probleme ?? (l.page?.hasAudio ? "Remplacera l'audio existant" : "Nouveau")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex gap-3">
            <button type="button" className={btnPrimaryCls} disabled={busy || valides.length === 0} onClick={() => void envoyer()}>
              {busy ? "Envoi…" : `Envoyer ${valides.length} fichier(s)`}
            </button>
            <button type="button" className={btnCls} disabled={busy} onClick={() => setLignes([])}>Vider</button>
          </div>
        </>
      )}
    </div>
  );
}
