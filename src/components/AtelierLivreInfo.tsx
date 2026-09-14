import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { cleErreurAtelier } from "@/lib/atelier-erreurs";
import {
  saveAtelierLivreInfo,
  type AtelierLivreInfo,
  type CollectionChoice,
} from "@/lib/atelier-livre.functions";

/**
 * L'onglet « Informations » : les colonnes de `books` qui existent déjà, rien
 * de plus. Aucun appel de traduction, aucun indicateur « à traduire » : les
 * champs anglais sont des champs de saisie ordinaires.
 */

const STATUSES = [
  "idea",
  "writing",
  "vocalizing",
  "proofreading",
  "layout",
  "bat_ok",
  "printing",
  "published",
  "retired",
] as const;

const input = "border-line w-full border px-2 py-1 text-[13px]";
const label = "block text-[12px] opacity-80";

function Champ({ labelKey, children }: { labelKey: DictKey; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <label className="block">
      <span className={label}>{t(labelKey)}</span>
      {children}
    </label>
  );
}

function Liste({
  labelKey,
  values,
  onChange,
}: {
  labelKey: DictKey;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      <span className={label}>{t(labelKey)}</span>
      {values.map((v, i) => (
        <div key={i} className="mt-1 flex gap-2">
          <input
            className={input}
            value={v}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="border-line shrink-0 border px-2 text-[12px]"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            {t("atelier.livre.line.remove")}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="border-line mt-2 border px-2 py-0.5 text-[12px]"
        onClick={() => onChange([...values, ""])}
      >
        {t("atelier.livre.line.add")}
      </button>
    </div>
  );
}

function num(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

export function LivreInfoForm({
  info,
  collections,
  onSaved,
}: {
  info: AtelierLivreInfo;
  collections: CollectionChoice[];
  onSaved: (slug: string) => void;
}) {
  const { t } = useI18n();
  const save = useServerFn(saveAtelierLivreInfo);
  const [form, setForm] = useState({ ...info });
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<DictKey | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setState("idle");
  }

  const urls: [DictKey, keyof typeof form][] = [
    ["atelier.livre.f.amazonFr", "amazonUrlFr"],
    ["atelier.livre.f.amazonCom", "amazonUrlCom"],
    ["atelier.livre.f.amazonOther", "amazonUrlOther"],
  ];

  async function submit() {
    setError(null);
    if (form.titleFr.trim().length === 0) return setError("atelier.livre.err.titleRequired");
    if (!/^[a-z0-9-]+$/.test(form.slug.trim())) return setError("atelier.livre.err.slugForm");
    if (!/^[A-Z0-9]{3,8}$/.test(form.qrCode.trim().toUpperCase()))
      return setError("atelier.livre.err.qrForm");
    for (const [, key] of urls) {
      const v = String(form[key] ?? "").trim();
      if (v.length > 0 && !v.startsWith("https://")) return setError("atelier.livre.err.https");
    }

    setState("saving");
    try {
      const res = await save({
        data: {
          id: form.id,
          titleFr: form.titleFr.trim(),
          titleEn: form.titleEn,
          titleHe: form.titleHe,
          subtitleFr: form.subtitleFr,
          subtitleEn: form.subtitleEn,
          slug: form.slug.trim(),
          tomeNo: form.tomeNo,
          collectionId: form.collectionId,
          qrCode: form.qrCode.trim().toUpperCase(),
          blurbFr: form.blurbFr,
          blurbEn: form.blurbEn,
          levelNoteFr: form.levelNoteFr,
          levelNoteEn: form.levelNoteEn,
          whatYouLearnFr: form.whatYouLearnFr,
          whatYouLearnEn: form.whatYouLearnEn,
          amazonUrlFr: form.amazonUrlFr,
          amazonUrlCom: form.amazonUrlCom,
          amazonUrlOther: form.amazonUrlOther,
          amazonAsin: form.amazonAsin,
          coverUrl: form.coverUrl,
          samplePdfUrl: form.samplePdfUrl,
          pageCount: form.pageCount,
          chaptersCount: form.chaptersCount,
          status: form.status as (typeof STATUSES)[number],
          publishedAt: form.publishedAt,
        },
      });
      setState("saved");
      onSaved(res.slug);
    } catch (e) {
      setState("idle");
      setError(cleErreurAtelier(e));
    }
  }

  return (
    <div className="mt-6 max-w-[860px]">
      <h2 className="font-latin text-[15px]">{t("atelier.livre.info.identity")}</h2>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Champ labelKey="atelier.livre.f.titleFr">
          <input
            className={input}
            value={form.titleFr}
            onChange={(e) => set("titleFr", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.titleEn">
          <input
            className={input}
            value={form.titleEn}
            onChange={(e) => set("titleEn", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.titleHe">
          <input
            className={input}
            dir="rtl"
            lang="he"
            style={{ fontFamily: "var(--font-hebrew)", letterSpacing: "normal" }}
            value={form.titleHe}
            onChange={(e) => set("titleHe", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.slug">
          <input
            className={input}
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.subtitleFr">
          <input
            className={input}
            value={form.subtitleFr}
            onChange={(e) => set("subtitleFr", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.subtitleEn">
          <input
            className={input}
            value={form.subtitleEn}
            onChange={(e) => set("subtitleEn", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.tome">
          <input
            className={input}
            inputMode="numeric"
            value={form.tomeNo ?? ""}
            onChange={(e) => set("tomeNo", num(e.target.value))}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.collection">
          <select
            className={input}
            value={form.collectionId ?? ""}
            onChange={(e) => set("collectionId", e.target.value || null)}
          >
            <option value="">{t("atelier.livre.noCollection")}</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameFr}
              </option>
            ))}
          </select>
        </Champ>
        <Champ labelKey="atelier.livre.f.qr">
          <input
            className={input}
            value={form.qrCode}
            onChange={(e) => set("qrCode", e.target.value.toUpperCase())}
          />
        </Champ>
      </div>

      <h2 className="font-latin mt-8 text-[15px]">{t("atelier.livre.info.presentation")}</h2>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Champ labelKey="atelier.livre.f.blurbFr">
          <textarea
            className={input}
            rows={4}
            value={form.blurbFr}
            onChange={(e) => set("blurbFr", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.blurbEn">
          <textarea
            className={input}
            rows={4}
            value={form.blurbEn}
            onChange={(e) => set("blurbEn", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.levelFr">
          <textarea
            className={input}
            rows={2}
            value={form.levelNoteFr}
            onChange={(e) => set("levelNoteFr", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.levelEn">
          <textarea
            className={input}
            rows={2}
            value={form.levelNoteEn}
            onChange={(e) => set("levelNoteEn", e.target.value)}
          />
        </Champ>
        <Liste
          labelKey="atelier.livre.f.learnFr"
          values={form.whatYouLearnFr}
          onChange={(v) => set("whatYouLearnFr", v)}
        />
        <Liste
          labelKey="atelier.livre.f.learnEn"
          values={form.whatYouLearnEn}
          onChange={(v) => set("whatYouLearnEn", v)}
        />
      </div>

      <h2 className="font-latin mt-8 text-[15px]">{t("atelier.livre.info.purchase")}</h2>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {urls.map(([key, field]) => (
          <Champ key={field as string} labelKey={key}>
            <input
              className={input}
              value={String(form[field] ?? "")}
              onChange={(e) => set(field, e.target.value as never)}
            />
          </Champ>
        ))}
        <Champ labelKey="atelier.livre.f.asin">
          <input
            className={input}
            value={form.amazonAsin}
            onChange={(e) => set("amazonAsin", e.target.value)}
          />
        </Champ>
      </div>

      <h2 className="font-latin mt-8 text-[15px]">{t("atelier.livre.info.production")}</h2>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Champ labelKey="atelier.livre.f.cover">
          <input
            className={input}
            value={form.coverUrl}
            onChange={(e) => set("coverUrl", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.samplePdf">
          <input
            className={input}
            value={form.samplePdfUrl}
            onChange={(e) => set("samplePdfUrl", e.target.value)}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.pageCount">
          <input
            className={input}
            inputMode="numeric"
            value={form.pageCount ?? ""}
            onChange={(e) => set("pageCount", num(e.target.value))}
          />
        </Champ>
        <Champ labelKey="atelier.livre.f.chaptersCount">
          <input
            className={input}
            inputMode="numeric"
            value={form.chaptersCount ?? ""}
            onChange={(e) => set("chaptersCount", num(e.target.value))}
          />
        </Champ>
      </div>

      <h2 className="font-latin mt-8 text-[15px]">{t("atelier.livre.info.state")}</h2>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Champ labelKey="atelier.livre.f.status">
          <select
            className={input}
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Champ>
        <Champ labelKey="atelier.livre.f.publishedAt">
          <input
            className={input}
            type="date"
            value={form.publishedAt ? form.publishedAt.slice(0, 10) : ""}
            onChange={(e) => set("publishedAt", e.target.value ? e.target.value : null)}
          />
        </Champ>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          className="border-line border px-3 py-1 text-[13px]"
          onClick={() => void submit()}
          disabled={state === "saving"}
        >
          {state === "saving" ? t("atelier.livre.saving") : t("atelier.livre.save")}
        </button>
        {state === "saved" ? <span className="text-[13px]">{t("atelier.livre.saved")}</span> : null}
        {error ? <span className="text-[13px]">{t(error)}</span> : null}
      </div>
    </div>
  );
}
