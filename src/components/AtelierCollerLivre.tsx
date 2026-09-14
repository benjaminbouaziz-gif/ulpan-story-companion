import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { cleErreurAtelier } from "@/lib/atelier-erreurs";
import { analyserColle } from "@/lib/coller-livre";
import {
  atelierLivrePages,
  collerLivre,
  SUPPORT_KINDS_BASE,
  type SupportKindBase,
} from "@/lib/atelier-livre.functions";

/**
 * BRIQUE 7 — l'écran de collage. « Analyser » n'écrit rien : il montre le
 * tableau de contrôle. « Créer les pages » n'apparaît qu'après une analyse
 * sans écart. Les deux textes restent deux saisies distinctes : aucun n'est
 * calculé à partir de l'autre.
 */

const input = "border-line w-full border px-2 py-1 text-[13px]";
const labelCls = "block text-[12px] opacity-80";
const cell = "border-line border-b px-2 py-1 text-left align-top";
const hebrew = {
  fontFamily: "var(--font-hebrew)",
  letterSpacing: "normal",
  fontSize: "17px",
  lineHeight: 1.9,
} as const;

export function CollerLivre({ bookId, slug }: { bookId: string; slug: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const listePages = useServerFn(atelierLivrePages);
  const coller = useServerFn(collerLivre);

  const pages = useQuery({
    queryKey: ["atelier", "livre-pages", bookId],
    queryFn: () => listePages({ data: { bookId } }),
  });

  const [nikud, setNikud] = useState("");
  const [plain, setPlain] = useState("");
  const [runningHeadFr, setRunningHeadFr] = useState("");
  const [runningHeadEn, setRunningHeadEn] = useState("");
  const [supportKind, setSupportKind] = useState<SupportKindBase>("translation");
  const [remplacer, setRemplacer] = useState(false);
  const [analyse, setAnalyse] = useState<ReturnType<typeof analyserColle> | null>(null);
  const [state, setState] = useState<"idle" | "writing">("idle");
  const [error, setError] = useState<DictKey | null>(null);

  const existantes = useMemo(() => (pages.data ?? []).map((p) => p.pageNo), [pages.data]);

  function analyser() {
    setError(null);
    setAnalyse(analyserColle(nikud, plain, existantes, remplacer));
  }

  async function ecrire() {
    setError(null);
    setState("writing");
    try {
      await coller({
        data: {
          bookId,
          nikud,
          plain,
          runningHeadFr,
          runningHeadEn,
          supportKind,
          remplacer,
        },
      });
      await navigate({
        to: "/atelier/livres/$slug",
        params: { slug },
        search: { onglet: "pages" as const },
      });
    } catch (e) {
      setState("idle");
      setError(cleErreurAtelier(e));
    }
  }

  return (
    <div>
      <p className="max-w-[65ch] text-[13px]">{t("atelier.livre.coller.intro")}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.runningHeadFr")}</span>
          <input
            className={input}
            value={runningHeadFr}
            onChange={(e) => setRunningHeadFr(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.runningHeadEn")}</span>
          <input
            className={input}
            value={runningHeadEn}
            onChange={(e) => setRunningHeadEn(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.support")}</span>
          <select
            className={input}
            value={supportKind}
            onChange={(e) => setSupportKind(e.target.value as SupportKindBase)}
          >
            {SUPPORT_KINDS_BASE.map((k) => (
              <option key={k} value={k}>
                {t(`atelier.livre.support.${k}` as DictKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.blocks.heNikud")}</span>
          <textarea
            className={input}
            rows={20}
            dir="rtl"
            lang="he"
            style={hebrew}
            value={nikud}
            onChange={(e) => {
              setNikud(e.target.value);
              setAnalyse(null);
            }}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.blocks.hePlain")}</span>
          <textarea
            className={input}
            rows={20}
            dir="rtl"
            lang="he"
            style={hebrew}
            value={plain}
            onChange={(e) => {
              setPlain(e.target.value);
              setAnalyse(null);
            }}
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={remplacer}
          onChange={(e) => {
            setRemplacer(e.target.checked);
            setAnalyse(null);
          }}
        />
        {t("atelier.livre.coller.replace")}
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
        <button type="button" className="border-line border px-3 py-1" onClick={analyser}>
          {t("atelier.livre.coller.analyse")}
        </button>
        {analyse?.ok ? (
          <button
            type="button"
            className="border-line border px-3 py-1"
            disabled={state === "writing"}
            onClick={() => void ecrire()}
          >
            {state === "writing"
              ? t("atelier.livre.coller.writing")
              : t("atelier.livre.coller.write")}
          </button>
        ) : null}
        {error ? <span>{t(error)}</span> : null}
      </div>

      {analyse ? (
        analyse.lignes.length === 0 ? (
          <p className="mt-4 text-[13px]">{t("atelier.livre.coller.none")}</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={cell}>{t("atelier.livre.pages.col.no")}</th>
                <th className={cell}>{t("atelier.livre.pages.col.chapter")}</th>
                <th className={cell}>{t("atelier.livre.coller.col.left")}</th>
                <th className={cell}>{t("atelier.livre.coller.col.right")}</th>
                <th className={cell}>{t("atelier.livre.coller.col.verdict")}</th>
              </tr>
            </thead>
            <tbody>
              {analyse.lignes.map((l) => (
                <tr key={l.pageNo}>
                  <td className={cell}>{l.pageNo}</td>
                  <td className={cell}>{l.chapterNo ?? t("atelier.none")}</td>
                  <td className={cell}>{l.gauche ?? t("atelier.none")}</td>
                  <td className={cell}>{l.droite ?? t("atelier.none")}</td>
                  <td className={cell}>
                    {t(`atelier.livre.coller.verdict.${l.verdict}` as DictKey)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
    </div>
  );
}
