import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/SiteChrome";
import { MirrorReader } from "@/components/MirrorReader";
import { useI18n } from "@/i18n/context";
import type { Lang } from "@/i18n/dictionaries";
import {
  adminListSegments,
  adminMe,
  adminSaveSegment,
} from "@/lib/admin-segments.functions";
import { stripNikud, type MirrorSegment, type MirrorToken } from "@/lib/segments";

export const Route = createFileRoute("/admin/extraits")({
  head: () => ({
    meta: [
      { title: "Extraits alignés — Administration" },
      { name: "description", content: "Outil d'alignement mot à mot des extraits." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AlignTool,
});

/** Découpe une traduction en mots, avec leurs bornes de caractères. */
function words(text: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function AlignTool() {
  const { t } = useI18n();
  const me = useServerFn(adminMe);
  const list = useServerFn(adminListSegments);
  const save = useServerFn(adminSaveSegment);

  const [bookSlug, setBookSlug] = useState("eli-cohen");
  const [editLang, setEditLang] = useState<Lang>("fr");
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [tokenIndex, setTokenIndex] = useState(0);
  const [draft, setDraft] = useState<MirrorSegment | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const meQuery = useQuery({ queryKey: ["admin", "me"], queryFn: () => me(), retry: false });
  const segmentsQuery = useQuery({
    queryKey: ["admin", "segments", bookSlug],
    queryFn: () => list({ data: { bookSlug } }),
    enabled: Boolean(meQuery.data?.isEditor),
    retry: false,
  });

  const segments = segmentsQuery.data?.segments ?? [];
  const current = useMemo(
    () => segments.find((s) => s.id === segmentId) ?? null,
    [segments, segmentId],
  );

  useEffect(() => {
    setDraft(current ? { ...current, tokens: current.tokens.map((tk) => ({ ...tk })) } : null);
    setTokenIndex(0);
  }, [current]);

  const saveMutation = useMutation({
    mutationFn: async (segment: MirrorSegment) =>
      save({
        data: {
          id: segment.id,
          support_fr: segment.support_fr,
          support_en: segment.support_en,
          hard_words_fr: segment.hard_words_fr,
          hard_words_en: segment.hard_words_en,
          tokens: segment.tokens,
        },
      }),
    onSuccess: (res) => {
      setMessage(res.ok ? "Enregistré." : (res.error ?? "Erreur."));
      segmentsQuery.refetch();
    },
    onError: () => setMessage("Erreur d'enregistrement."),
  });

  if (meQuery.isLoading) {
    return (
      <PageShell>
        <p className="body-text">…</p>
      </PageShell>
    );
  }

  if (!meQuery.data?.isEditor) {
    return (
      <PageShell>
        <h1 className="text-[26px]">{t("admin.segments")}</h1>
        <p className="body-text text-secondary-text mt-4">{t("admin.forbidden")}</p>
      </PageShell>
    );
  }

  const support =
    (editLang === "en" ? draft?.support_en : draft?.support_fr) ?? "";
  const supportWords = words(support);
  const token: MirrorToken | undefined = draft?.tokens[tokenIndex];
  const range = token
    ? ((editLang === "en" ? token.support_range_en : token.support_range_fr) ?? null)
    : null;

  function patchToken(patch: Partial<MirrorToken>) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            tokens: prev.tokens.map((tk, i) => (i === tokenIndex ? { ...tk, ...patch } : tk)),
          }
        : prev,
    );
  }

  function clickWord(start: number, end: number) {
    const next: [number, number] = range
      ? [Math.min(range[0], start), Math.max(range[1], end)]
      : [start, end];
    patchToken(editLang === "en" ? { support_range_en: next } : { support_range_fr: next });
  }

  return (
    <PageShell>
      <h1 className="text-[26px]">{t("admin.segments")}</h1>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="label text-secondary-text flex flex-col gap-1">
          Livre
          <input
            value={bookSlug}
            onChange={(e) => setBookSlug(e.target.value)}
            className="border-line body-text touch border px-2"
          />
        </label>
        <div className="flex gap-2">
          {(["fr", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setEditLang(l)}
              aria-pressed={editLang === l}
              className={`label touch border-line border px-3 ${
                editLang === l ? "bg-foreground text-background" : ""
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <section className="border-line mt-8 border-t pt-6">
        <h2 className="label text-secondary-text">Segments</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {segments.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSegmentId(s.id)}
                className={`border-line w-full border p-3 text-right ${
                  s.id === segmentId ? "border-foreground" : ""
                }`}
              >
                <span dir="rtl" lang="he" className="hebrew">
                  {s.he_nikud}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {draft ? (
        <>
          <section className="border-line mt-8 border-t pt-6">
            <h2 className="label text-secondary-text">Mot hébreu</h2>
            <div className="mt-3 flex flex-wrap gap-2" dir="rtl">
              {draft.tokens.map((tk, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTokenIndex(i)}
                  aria-pressed={i === tokenIndex}
                  className={`hebrew border-line touch border px-2 ${
                    i === tokenIndex ? "border-foreground" : ""
                  }`}
                >
                  {tk.he_nikud}
                </button>
              ))}
            </div>
            {token ? (
              <p className="label text-secondary-text mt-2" dir="ltr">
                {stripNikud(token.he_nikud)} · {range ? `[${range[0]}, ${range[1]}]` : "non aligné"}
              </p>
            ) : null}
          </section>

          <section className="border-line mt-8 border-t pt-6">
            <h2 className="label text-secondary-text">
              Traduction — touchez les mots correspondants
            </h2>
            <p className="mt-3 flex flex-wrap gap-x-1 gap-y-2">
              {supportWords.map((w) => {
                const inRange = range ? w.start >= range[0] && w.end <= range[1] : false;
                return (
                  <button
                    key={w.start}
                    type="button"
                    onClick={() => clickWord(w.start, w.end)}
                    className={`body-text border-b ${
                      inRange ? "border-foreground bg-foreground/10" : "border-transparent"
                    }`}
                  >
                    {w.text}
                  </button>
                );
              })}
            </p>
            <button
              type="button"
              onClick={() =>
                patchToken(
                  editLang === "en" ? { support_range_en: null } : { support_range_fr: null },
                )
              }
              className="label touch border-line mt-3 border px-3"
            >
              Effacer l'alignement
            </button>
          </section>

          {token ? (
            <section className="border-line mt-8 border-t pt-6">
              <h2 className="label text-secondary-text">Glose et difficulté</h2>
              <label className="label text-secondary-text mt-3 flex flex-col gap-1">
                Glose {editLang.toUpperCase()}
                <input
                  value={(editLang === "en" ? token.gloss_en : token.gloss_fr) ?? ""}
                  onChange={(e) =>
                    patchToken(
                      editLang === "en"
                        ? { gloss_en: e.target.value || null }
                        : { gloss_fr: e.target.value || null },
                    )
                  }
                  className="border-line body-text touch border px-2"
                />
              </label>
              <label className="label text-secondary-text mt-3 flex flex-col gap-1">
                Translittération
                <input
                  value={token.translit ?? ""}
                  onChange={(e) => patchToken({ translit: e.target.value || null })}
                  className="border-line body-text touch border px-2"
                />
              </label>
              <label className="label touch mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={token.is_hard === true}
                  onChange={(e) => patchToken({ is_hard: e.target.checked })}
                />
                Mot difficile
              </label>
            </section>
          ) : null}

          <section className="border-line mt-8 border-t pt-6">
            <h2 className="label text-secondary-text">Aperçu</h2>
            <div className="mt-3">
              <MirrorReader segments={[draft]} />
            </div>
          </section>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate(draft)}
              className="label touch border-line bg-foreground text-background border px-4"
            >
              Enregistrer
            </button>
            {message ? <p className="label text-secondary-text">{message}</p> : null}
          </div>
        </>
      ) : (
        <p className="body-text text-secondary-text mt-6">
          Choisissez un segment pour l'aligner.
        </p>
      )}
    </PageShell>
  );
}
