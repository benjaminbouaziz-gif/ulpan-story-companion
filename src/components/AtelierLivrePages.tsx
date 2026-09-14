import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { cleErreurAtelier } from "@/lib/atelier-erreurs";
import {
  atelierLivrePages,
  createAtelierPage,
  removeAtelierPageAudio,
  setAtelierPagePublished,
  uploadAtelierPageAudio,
} from "@/lib/atelier-livre.functions";

/** L'onglet « Pages » : le sommaire des pages saisies, une ligne par page. */
const cell = "border-line border-b px-2 py-1 text-left align-top";
const btn = "border-line border px-2 py-0.5 text-[12px]";
const MAX = 50 * 1024 * 1024;

function extensionValide(name: string): boolean {
  const n = name.toLowerCase();
  return n.endsWith(".m4a") || n.endsWith(".mp3");
}

/** Le numéro de page est le dernier nombre entier trouvé dans le nom du fichier. */
function pageDuNom(name: string): number | null {
  const nombres = name.replace(/\.[^.]+$/, "").match(/\d+/g);
  if (!nombres || nombres.length === 0) return null;
  const dernier = Number(nombres[nombres.length - 1]);
  return Number.isFinite(dernier) ? dernier : null;
}

type LotLigne = {
  file: File;
  pageNo: number | null;
  pageId: string | null;
  verdict: "new" | "replace" | "rejected";
  reason: DictKey | null;
  result: "ok" | "fail" | null;
};

export function LivrePagesTable({ bookId, slug }: { bookId: string; slug: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const list = useServerFn(atelierLivrePages);
  const create = useServerFn(createAtelierPage);
  const publish = useServerFn(setAtelierPagePublished);
  const upload = useServerFn(uploadAtelierPageAudio);
  const remove = useServerFn(removeAtelierPageAudio);

  const pages = useQuery({
    queryKey: ["atelier", "livre-pages", bookId],
    queryFn: () => list({ data: { bookId } }),
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, DictKey>>({});
  const [lot, setLot] = useState<LotLigne[] | null>(null);
  const [lotEnCours, setLotEnCours] = useState(false);
  const [lotFini, setLotFini] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lotRef = useRef<HTMLInputElement>(null);

  const rows = pages.data ?? [];

  function poserErreur(id: string, cle: DictKey) {
    setErreurs((e) => ({ ...e, [id]: cle }));
  }
  function effacerErreur(id: string) {
    setErreurs((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
  }

  async function nouvelle() {
    const res = await create({ data: { bookId } });
    await navigate({ to: "/atelier/livres/$slug/page/$pageId", params: { slug, pageId: res.id } });
  }

  async function basculerPublication(id: string, valeur: boolean) {
    effacerErreur(id);
    setBusy(id);
    try {
      await publish({ data: { pageId: id, isPublished: valeur } });
      await pages.refetch();
    } catch (e) {
      poserErreur(id, cleErreurAtelier(e));
    } finally {
      setBusy(null);
    }
  }

  async function deposer(id: string, file: File, remplace: boolean) {
    effacerErreur(id);
    if (!extensionValide(file.name)) return poserErreur(id, "atelier.livre.audio.err.format");
    if (file.size > MAX) return poserErreur(id, "atelier.livre.audio.err.tooBig");
    if (remplace && !window.confirm(t("atelier.livre.audio.replaceConfirm"))) return;

    setBusy(id);
    try {
      const body = new FormData();
      body.set("pageId", id);
      body.set("file", file);
      await upload({ data: body });
      await pages.refetch();
    } catch (e) {
      poserErreur(id, cleErreurAtelier(e));
    } finally {
      setBusy(null);
    }
  }

  async function retirer(id: string) {
    effacerErreur(id);
    if (!window.confirm(t("atelier.livre.audio.removeConfirm"))) return;
    setBusy(id);
    try {
      await remove({ data: { pageId: id } });
      await pages.refetch();
    } catch (e) {
      poserErreur(id, cleErreurAtelier(e));
    } finally {
      setBusy(null);
    }
  }

  /** Tableau de contrôle : rien n'est écrit avant confirmation. */
  function preparerLot(files: File[]) {
    setLotFini(false);
    const compte = new Map<number, number>();
    for (const f of files) {
      const n = pageDuNom(f.name);
      if (n !== null) compte.set(n, (compte.get(n) ?? 0) + 1);
    }
    const lignes: LotLigne[] = files.map((file) => {
      const pageNo = pageDuNom(file.name);
      const page = pageNo === null ? undefined : rows.find((r) => r.pageNo === pageNo);
      let reason: DictKey | null = null;
      if (!extensionValide(file.name)) reason = "atelier.livre.audio.err.format";
      else if (file.size > MAX) reason = "atelier.livre.audio.err.tooBig";
      else if (pageNo === null) reason = "atelier.livre.pages.lot.err.noNumber";
      else if ((compte.get(pageNo) ?? 0) > 1) reason = "atelier.livre.pages.lot.err.dup";
      else if (!page) reason = "atelier.livre.pages.lot.err.noPage";
      return {
        file,
        pageNo,
        pageId: reason ? null : (page?.id ?? null),
        verdict: reason ? "rejected" : page?.hasAudio ? "replace" : "new",
        reason,
        result: null,
      };
    });
    setLot(lignes);
  }

  async function envoyerLot() {
    if (!lot) return;
    const aRemplacer = lot.some((l) => l.verdict === "replace");
    if (aRemplacer && !window.confirm(t("atelier.livre.pages.lot.replaceConfirm"))) return;

    setLotEnCours(true);
    const resultats: LotLigne[] = [];
    for (const ligne of lot) {
      if (!ligne.pageId) {
        resultats.push({ ...ligne, result: "fail" });
        continue;
      }
      try {
        const body = new FormData();
        body.set("pageId", ligne.pageId);
        body.set("file", ligne.file);
        await upload({ data: body });
        resultats.push({ ...ligne, result: "ok" });
      } catch {
        resultats.push({ ...ligne, result: "fail" });
      }
      setLot([...resultats, ...lot.slice(resultats.length)]);
    }
    setLot(resultats);
    setLotEnCours(false);
    setLotFini(true);
    await pages.refetch();
  }

  const lotOk = lot?.filter((l) => l.result === "ok").length ?? 0;
  const lotKo = lot?.filter((l) => l.result === "fail").length ?? 0;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="border-line border px-2 py-0.5 text-[13px]"
          onClick={() => void nouvelle()}
        >
          {t("atelier.livre.pages.new")}
        </button>
        <Link
          to="/atelier/livres/$slug/coller"
          params={{ slug }}
          className="border-line border px-2 py-0.5 text-[13px]"
        >
          {t("atelier.livre.coller.open")}
        </Link>
        <button
          type="button"
          className="border-line border px-2 py-0.5 text-[13px]"
          onClick={() => lotRef.current?.click()}
        >
          {t("atelier.livre.pages.lot.open")}
        </button>
        <input
          ref={lotRef}
          type="file"
          multiple
          accept=".m4a,.mp3,audio/mp4,audio/mpeg"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) preparerLot(files);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-2 text-[12px] opacity-70">{t("atelier.livre.pages.lot.hint")}</p>

      {lot ? (
        <section className="border-line mt-4 border p-2">
          <h3 className="text-[13px]">{t("atelier.livre.pages.lot.title")}</h3>
          <table className="mt-2 w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className={cell}>{t("atelier.livre.pages.lot.col.file")}</th>
                <th className={cell}>{t("atelier.livre.pages.lot.col.page")}</th>
                <th className={cell}>{t("atelier.livre.pages.lot.col.verdict")}</th>
              </tr>
            </thead>
            <tbody>
              {lot.map((l, i) => (
                <tr key={`${l.file.name}-${i}`}>
                  <td className={cell}>{l.file.name}</td>
                  <td className={cell}>{l.pageNo ?? t("atelier.none")}</td>
                  <td className={cell}>
                    {l.result === "ok"
                      ? t("atelier.livre.pages.lot.sent")
                      : l.result === "fail"
                        ? t("atelier.livre.pages.lot.failed")
                        : l.reason
                          ? `${t("atelier.livre.pages.lot.rejected")} — ${t(l.reason)}`
                          : l.verdict === "replace"
                            ? t("atelier.livre.pages.lot.replace")
                            : t("atelier.livre.pages.lot.new")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
            {lotFini ? null : (
              <button
                type="button"
                className={btn}
                onClick={() => void envoyerLot()}
                disabled={lotEnCours || lot.every((l) => !l.pageId)}
              >
                {lotEnCours
                  ? t("atelier.livre.audio.uploading")
                  : t("atelier.livre.pages.lot.send")}
              </button>
            )}
            <button
              type="button"
              className={btn}
              onClick={() => setLot(null)}
              disabled={lotEnCours}
            >
              {t(lotFini ? "atelier.livre.pages.lot.close" : "atelier.livre.pages.lot.cancel")}
            </button>
            {lotFini ? (
              <span>
                {t("atelier.livre.pages.lot.resultOk")} {lotOk} · {""}
                {t("atelier.livre.pages.lot.resultFail")} {lotKo}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {pages.isLoading ? (
        <p className="mt-4 text-[13px]">{t("atelier.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-[13px]">{t("atelier.livre.pages.empty")}</p>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files ?? []);
            if (files.length > 0) preparerLot(files);
          }}
        >
          <table className="mt-4 w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={cell}>{t("atelier.livre.pages.col.no")}</th>
                <th className={cell}>{t("atelier.livre.pages.col.chapter")}</th>
                <th className={cell}>{t("atelier.livre.pages.col.support")}</th>
                <th className={cell}>{t("atelier.livre.pages.col.audio")}</th>
                <th className={cell}>{t("atelier.livre.pages.col.published")}</th>
                <th className={cell} />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const enCours = busy === p.id;
                return (
                  <tr key={p.id} className={enCours ? "opacity-60" : undefined}>
                    <td className={cell}>{p.pageNo}</td>
                    <td className={cell}>{p.chapterNo ?? t("atelier.none")}</td>
                    <td className={cell}>
                      {t(`atelier.livre.support.${p.supportKind}` as DictKey)}
                    </td>
                    <td className={cell}>
                      <div className="flex flex-wrap items-center gap-1">
                        {p.hasAudio ? (
                          <>
                            <span>{t("atelier.livre.yes")}</span>
                            <button
                              type="button"
                              className={btn}
                              disabled={enCours}
                              onClick={() => fileRefs.current[p.id]?.click()}
                            >
                              {t("atelier.livre.pages.audio.replace")}
                            </button>
                            <button
                              type="button"
                              className={btn}
                              disabled={enCours}
                              onClick={() => void retirer(p.id)}
                            >
                              {t("atelier.livre.pages.audio.remove")}
                            </button>
                          </>
                        ) : (
                          <>
                            <span>{t("atelier.livre.no")}</span>
                            <button
                              type="button"
                              className={btn}
                              disabled={enCours}
                              onClick={() => fileRefs.current[p.id]?.click()}
                            >
                              {t("atelier.livre.pages.audio.deposit")}
                            </button>
                          </>
                        )}
                        {enCours ? (
                          <span className="text-[12px]">
                            {t("atelier.livre.audio.uploading")}
                          </span>
                        ) : null}
                        <input
                          ref={(el) => {
                            fileRefs.current[p.id] = el;
                          }}
                          type="file"
                          accept=".m4a,.mp3,audio/mp4,audio/mpeg"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void deposer(p.id, file, p.hasAudio);
                          }}
                        />
                      </div>
                      {erreurs[p.id] ? (
                        <p className="mt-1 text-[12px]">{t(erreurs[p.id]!)}</p>
                      ) : null}
                    </td>
                    <td className={cell}>
                      <input
                        type="checkbox"
                        checked={p.isPublished}
                        disabled={enCours}
                        onChange={(e) => void basculerPublication(p.id, e.target.checked)}
                      />
                    </td>
                    <td className={cell}>
                      <Link
                        to="/atelier/livres/$slug/page/$pageId"
                        params={{ slug, pageId: p.id }}
                        className="border-b border-current"
                      >
                        {t("atelier.livre.open")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
