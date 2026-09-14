import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { cleErreurAtelier } from "@/lib/atelier-erreurs";
import { stripNikud } from "@/lib/spread";
import { PageAudio } from "./AtelierPageAudio";
import {
  atelierPage,
  BLOCK_KINDS,
  deleteAtelierPage,
  saveAtelierPage,
  SUPPORT_KINDS,
  type AtelierBlock,
  type BlockKindValue,
  type SupportKindValue,
} from "@/lib/atelier-livre.functions";

/**
 * L'ÉDITEUR DE PAGE. Rien ne s'enregistre en cours de frappe : un seul bouton
 * écrit la page et ses paragraphes. `he_plain` se dérive de `he_nikud` par
 * stripNikud, et cesse de se régénérer dès qu'il est corrigé à la main.
 */

const input = "border-line w-full border px-2 py-1 text-[13px]";
const labelCls = "block text-[12px] opacity-80";

type Bloc = AtelierBlock & { plainManual: boolean };

export function PageEditor({ pageId }: { pageId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const read = useServerFn(atelierPage);
  const save = useServerFn(saveAtelierPage);
  const del = useServerFn(deleteAtelierPage);

  const page = useQuery({
    queryKey: ["atelier", "livre-page", pageId],
    queryFn: () => read({ data: { pageId } }),
  });

  const [form, setForm] = useState<{
    pageNo: string;
    chapterNo: string;
    supportKind: SupportKindValue;
    chapterTitleHe: string;
    chapterTitleFr: string;
    chapterTitleEn: string;
    runningHeadFr: string;
    runningHeadEn: string;
    folio: string;
    isPublished: boolean;
  } | null>(null);
  const [blocks, setBlocks] = useState<Bloc[]>([]);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<DictKey | null>(null);

  const data = page.data ?? null;

  useEffect(() => {
    if (!data) return;
    setForm({
      pageNo: String(data.pageNo),
      chapterNo: data.chapterNo === null ? "" : String(data.chapterNo),
      supportKind: data.supportKind as SupportKindValue,
      chapterTitleHe: data.chapterTitleHe,
      chapterTitleFr: data.chapterTitleFr,
      chapterTitleEn: data.chapterTitleEn,
      runningHeadFr: data.runningHeadFr,
      runningHeadEn: data.runningHeadEn,
      folio: data.folio === null ? "" : String(data.folio),
      isPublished: data.isPublished,
    });
    setBlocks(
      data.blocks.map((b) => ({
        ...b,
        // Un texte déjà différent de la dérivation est une correction humaine.
        plainManual: b.hePlain.length > 0 && b.hePlain !== stripNikud(b.heNikud),
      })),
    );
    setDirty(false);
    setState("idle");
  }, [data]);

  // Prévenir avant de quitter avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function touch() {
    setDirty(true);
    setState("idle");
  }

  function setField<K extends keyof NonNullable<typeof form>>(
    key: K,
    value: NonNullable<typeof form>[K],
  ) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    touch();
  }

  function setBloc(i: number, patch: Partial<Bloc>) {
    setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    touch();
  }

  function bougerBloc(i: number, delta: number) {
    setBlocks((bs) => {
      const next = [...bs];
      const j = i + delta;
      if (j < 0 || j >= next.length) return bs;
      const a = next[i]!;
      next[i] = next[j]!;
      next[j] = a;
      return next;
    });
    touch();
  }

  async function enregistrer() {
    if (!form) return;
    setError(null);
    const pageNo = Number.parseInt(form.pageNo, 10);
    if (!Number.isFinite(pageNo) || pageNo < 1) {
      return setError("atelier.livre.page.err.pageNoRequired");
    }
    const chapterNo = form.chapterNo.trim() === "" ? null : Number.parseInt(form.chapterNo, 10);
    const folio = form.folio.trim() === "" ? null : Number.parseInt(form.folio, 10);

    setState("saving");
    try {
      await save({
        data: {
          pageId,
          pageNo,
          chapterNo: Number.isFinite(chapterNo as number) ? (chapterNo as number) : null,
          supportKind: form.supportKind,
          chapterTitleHe: form.chapterTitleHe,
          chapterTitleFr: form.chapterTitleFr,
          chapterTitleEn: form.chapterTitleEn,
          runningHeadFr: form.runningHeadFr,
          runningHeadEn: form.runningHeadEn,
          folio: Number.isFinite(folio as number) ? (folio as number) : null,
          isPublished: form.isPublished,
          blocks: blocks.map((b) => ({
            id: b.id,
            blockKind: b.blockKind,
            heNikud: b.heNikud,
            hePlain: b.hePlain,
            supportFr: b.supportFr,
            supportEn: b.supportEn,
          })),
        },
      });
      setDirty(false);
      setState("saved");
      await page.refetch();
    } catch (e) {
      setState("idle");
      setError(cleErreurAtelier(e));
    }
  }

  async function supprimer() {
    if (!window.confirm(t("atelier.livre.page.deleteConfirm"))) return;
    try {
      await del({ data: { pageId } });
      setDirty(false);
      await navigate({
        to: "/atelier/livres/$slug",
        params: { slug: data?.bookSlug ?? "" },
        search: { onglet: "pages" },
      });
    } catch (e) {
      setError(cleErreurAtelier(e));
    }
  }

  if (page.isLoading) return <p className="text-[13px]">{t("atelier.loading")}</p>;
  if (!data || !form) return <p className="text-[13px]">{t("atelier.livre.page.notFound")}</p>;

  return (
    <div className="max-w-[900px]">
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.pageNo")}</span>
          <input
            className={input}
            inputMode="numeric"
            value={form.pageNo}
            onChange={(e) => setField("pageNo", e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.chapterNo")}</span>
          <input
            className={input}
            inputMode="numeric"
            value={form.chapterNo}
            onChange={(e) => setField("chapterNo", e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.support")}</span>
          <select
            className={input}
            value={form.supportKind}
            onChange={(e) => setField("supportKind", e.target.value as SupportKindValue)}
          >
            {SUPPORT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`atelier.livre.support.${k}` as DictKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.chapterTitleHe")}</span>
          <input
            className={input}
            dir="rtl"
            lang="he"
            style={{ fontFamily: "var(--font-hebrew)", letterSpacing: "normal" }}
            value={form.chapterTitleHe}
            onChange={(e) => setField("chapterTitleHe", e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.chapterTitleFr")}</span>
          <input
            className={input}
            value={form.chapterTitleFr}
            onChange={(e) => setField("chapterTitleFr", e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.chapterTitleEn")}</span>
          <input
            className={input}
            value={form.chapterTitleEn}
            onChange={(e) => setField("chapterTitleEn", e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.runningHeadFr")}</span>
          <input
            className={input}
            value={form.runningHeadFr}
            onChange={(e) => setField("runningHeadFr", e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.runningHeadEn")}</span>
          <input
            className={input}
            value={form.runningHeadEn}
            onChange={(e) => setField("runningHeadEn", e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("atelier.livre.page.f.folio")}</span>
          <input
            className={input}
            inputMode="numeric"
            value={form.folio}
            onChange={(e) => setField("folio", e.target.value)}
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={form.isPublished}
          onChange={(e) => setField("isPublished", e.target.checked)}
        />
        {t("atelier.livre.page.f.published")}
      </label>

      <section className="border-line mt-8 border-t pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-latin text-[15px]">{t("atelier.livre.blocks.title")}</h2>
          <button
            type="button"
            className="border-line border px-2 py-0.5 text-[13px]"
            onClick={() => {
              setBlocks((bs) => [
                ...bs,
                {
                  id: null,
                  sortOrder: bs.length + 1,
                  // Un bloc naît en récit ; le dialogue est un choix explicite.
                  blockKind: "narrative" as BlockKindValue,
                  heNikud: "",
                  hePlain: "",
                  supportFr: "",
                  supportEn: "",
                  plainManual: false,
                },
              ]);
              touch();
            }}
          >
            {t("atelier.livre.blocks.add")}
          </button>
        </div>

        {blocks.length === 0 ? (
          <p className="mt-3 text-[13px]">{t("atelier.livre.blocks.empty")}</p>
        ) : (
          blocks.map((b, i) => (
            <div key={b.id ?? `nouveau-${i}`} className="border-line mt-4 border p-3">
              <div className="flex items-center justify-between text-[12px]">
                <span>{i + 1}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="border-line border px-2"
                    onClick={() => bougerBloc(i, -1)}
                  >
                    {t("atelier.livre.blocks.up")}
                  </button>
                  <button
                    type="button"
                    className="border-line border px-2"
                    onClick={() => bougerBloc(i, 1)}
                  >
                    {t("atelier.livre.blocks.down")}
                  </button>
                  <button
                    type="button"
                    className="border-line border px-2"
                    onClick={() => {
                      setBlocks((bs) => bs.filter((_, j) => j !== i));
                      touch();
                    }}
                  >
                    {t("atelier.livre.blocks.remove")}
                  </button>
                </span>
              </div>

              <label className="mt-2 block max-w-[260px]">
                <span className={labelCls}>{t("atelier.livre.blocks.kind")}</span>
                <select
                  className={input}
                  value={b.blockKind}
                  onChange={(e) => {
                    const blockKind = e.target.value as BlockKindValue;
                    setBlocks((bs) => bs.map((x, j) => (j === i ? { ...x, blockKind } : x)));
                    touch();
                  }}
                >
                  {BLOCK_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`atelier.livre.blocks.kind.${k}` as DictKey)}
                    </option>
                  ))}
                </select>
              </label>


              <label className="mt-2 block">
                <span className={labelCls}>{t("atelier.livre.blocks.heNikud")}</span>
                <textarea
                  className={input}
                  rows={5}
                  dir="rtl"
                  lang="he"
                  style={{
                    fontFamily: "var(--font-hebrew)",
                    letterSpacing: "normal",
                    fontSize: "18px",
                    lineHeight: 1.9,
                  }}
                  value={b.heNikud}
                  onChange={(e) => {
                    const heNikud = e.target.value;
                    setBloc(i, {
                      heNikud,
                      ...(b.plainManual ? {} : { hePlain: stripNikud(heNikud) }),
                    });
                  }}
                />
              </label>

              <label className="mt-2 block">
                <span className={labelCls}>
                  {t("atelier.livre.blocks.hePlain")} —{" "}
                  {b.plainManual
                    ? t("atelier.livre.blocks.hePlainManual")
                    : t("atelier.livre.blocks.hePlainAuto")}
                </span>
                <textarea
                  className={input}
                  rows={3}
                  dir="rtl"
                  lang="he"
                  style={{
                    fontFamily: "var(--font-hebrew)",
                    letterSpacing: "normal",
                    fontSize: "16px",
                    lineHeight: 1.9,
                  }}
                  value={b.hePlain}
                  onChange={(e) => setBloc(i, { hePlain: e.target.value, plainManual: true })}
                />
              </label>

              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>{t("atelier.livre.blocks.supportFr")}</span>
                  <textarea
                    className={input}
                    rows={3}
                    value={b.supportFr}
                    onChange={(e) => setBloc(i, { supportFr: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>{t("atelier.livre.blocks.supportEn")}</span>
                  <textarea
                    className={input}
                    rows={3}
                    value={b.supportEn}
                    onChange={(e) => setBloc(i, { supportEn: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))
        )}
      </section>

      <div className="mt-6 flex items-center gap-3 text-[13px]">
        <button
          type="button"
          className="border-line border px-3 py-1"
          onClick={() => void enregistrer()}
          disabled={state === "saving"}
        >
          {state === "saving" ? t("atelier.livre.saving") : t("atelier.livre.save")}
        </button>
        {state === "saved" ? <span>{t("atelier.livre.saved")}</span> : null}
        {dirty ? <span>{t("atelier.livre.page.dirty")}</span> : null}
        {error ? <span>{t(error)}</span> : null}
        <button
          type="button"
          className="border-line ml-auto border px-3 py-1"
          onClick={() => void supprimer()}
        >
          {t("atelier.livre.page.delete")}
        </button>
      </div>

      <PageAudio pageId={pageId} audioPath={data.audioPath} onChanged={() => void page.refetch()} />
    </div>
  );
}
