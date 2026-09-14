import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import { usePreferences } from "@/lib/preferences";
import type { CompanionPage } from "@/lib/companion.functions";

/**
 * BRIQUE 4 — LE LECTEUR.
 *
 * Il reçoit les pages et une fonction qui demande l'adresse d'écoute : il ne
 * connaît ni la base, ni le bucket, ni le slug du livre. Le texte affiché vient
 * toujours de la base — `he_nikud` avec les nekoudot, `he_plain` sans. Aucun
 * calcul ne fabrique l'orthographe non vocalisée.
 */

const SPEEDS = [0.75, 0.8, 0.9, 1] as const;

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatSpeed(v: number): string {
  return `× ${v.toFixed(2).replace(".", ",")}`;
}

type Props = {
  pages: CompanionPage[];
  requestAudioUrl: (pageId: string) => Promise<string | null>;
};

export function LecteurLivre({ pages, requestAudioUrl }: Props) {
  const { t, lang } = useI18n();
  const { speed, setSpeed } = usePreferences();

  const [index, setIndex] = useState(0);
  const [nikud, setNikud] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const page = pages[index];

  /** La hauteur du son ne doit pas descendre quand on ralentit. */
  const applyRate = useCallback(
    (el: HTMLAudioElement) => {
      const a = el as HTMLAudioElement & {
        preservesPitch?: boolean;
        mozPreservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
      };
      a.preservesPitch = true;
      a.mozPreservesPitch = true;
      a.webkitPreservesPitch = true;
      el.playbackRate = speed;
    },
    [speed],
  );

  useEffect(() => {
    const el = audioRef.current;
    if (el) applyRate(el);
  }, [applyRate, index]);

  // Changement de page : nouvelle source, retour à 0:00, en pause.
  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [index]);

  const chapters = useMemo(() => {
    const seen = new Map<number, number>();
    pages.forEach((p, i) => {
      if (p.chapter_no != null && !seen.has(p.chapter_no)) seen.set(p.chapter_no, i);
    });
    return [...seen.entries()].map(([no, first]) => ({ no, first }));
  }, [pages]);

  const nextWithAudio = useCallback(
    (from: number, step: 1 | -1) => {
      for (let i = from + step; i >= 0 && i < pages.length; i += step) {
        if (pages[i]?.has_audio) return i;
      }
      return null;
    },
    [pages],
  );

  const plainMissing = useMemo(
    () => (page?.blocks ?? []).some((b) => !(b.he_plain ?? "").trim()),
    [page],
  );

  const play = useCallback(async () => {
    const el = audioRef.current;
    if (!el || !page?.has_audio) return;
    if (!el.getAttribute("src")) {
      setLoading(true);
      const url = await requestAudioUrl(page.id);
      setLoading(false);
      if (!url) return;
      el.src = url;
    }
    applyRate(el);
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [applyRate, page, requestAudioUrl]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const nudge = useCallback((delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
  }, []);

  const seekTo = useCallback((ratio: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    el.currentTime = Math.max(0, Math.min(1, ratio)) * el.duration;
  }, []);

  const changeSpeed = useCallback(
    (v: number) => {
      setSpeed(v);
      const el = audioRef.current;
      if (el) {
        const a = el as HTMLAudioElement & {
          preservesPitch?: boolean;
          mozPreservesPitch?: boolean;
          webkitPreservesPitch?: boolean;
        };
        a.preservesPitch = true;
        a.mozPreservesPitch = true;
        a.webkitPreservesPitch = true;
        el.playbackRate = v;
      }
    },
    [setSpeed],
  );

  if (!page) return null;

  const chapterTitle = lang === "en" ? page.chapter_title_en : page.chapter_title_fr;
  const opensChapter = !!(page.chapter_title_he || chapterTitle);
  const ratio = duration > 0 ? current / duration : 0;
  const btn =
    "border-line label touch inline-flex min-h-[40px] min-w-[40px] items-center justify-center border px-3";

  return (
    <section
      className="select-none"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      <audio
        ref={audioRef}
        preload="none"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          applyRate(e.currentTarget);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={(e) => {
          e.currentTarget.currentTime = 0;
          setPlaying(false);
        }}
      />

      {/* La barre de lecture : collante, au-dessus du texte, jamais par-dessus. */}
      <div className="bg-paper border-line sticky top-0 z-20 border-b pb-3">
        <button
          type="button"
          className="border-line block w-full border-b"
          aria-label={t("reader.seek")}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - r.left) / r.width);
          }}
          style={{ height: 8 }}
        >
          <span
            className="block h-full"
            style={{ width: `${ratio * 100}%`, background: "currentColor" }}
          />
        </button>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btn}
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            aria-label={t("reader.prevPage")}
          >
            ‹‹
          </button>
          <button
            type="button"
            className={btn}
            disabled={!page.has_audio}
            onClick={() => nudge(-10)}
            aria-label={t("reader.back10")}
          >
            −10
          </button>
          <button
            type="button"
            className={btn}
            disabled={!page.has_audio || loading}
            onClick={() => (playing ? pause() : void play())}
          >
            {playing ? t("reader.pause") : t("reader.play")}
          </button>
          <button
            type="button"
            className={btn}
            disabled={!page.has_audio}
            onClick={() => nudge(10)}
            aria-label={t("reader.fwd10")}
          >
            +10
          </button>
          <button
            type="button"
            className={btn}
            disabled={index >= pages.length - 1}
            onClick={() => {
              const target = page.has_audio
                ? index + 1
                : (nextWithAudio(index, 1) ?? Math.min(pages.length - 1, index + 1));
              setIndex(target);
            }}
            aria-label={t("reader.nextPage")}
          >
            ››
          </button>

          <span className="label text-secondary-text tabular-nums">
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <button
            type="button"
            className={btn}
            disabled={plainMissing && nikud}
            onClick={() => setNikud((v) => !v)}
            aria-pressed={nikud}
          >
            {t("reader.nikud")}
          </button>

          <label className="label text-secondary-text flex items-center gap-2">
            {t("reader.page")}
            <select
              className="border-line touch min-h-[40px] border bg-transparent px-2"
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
            >
              {pages.map((p, i) => (
                <option key={p.id} value={i}>
                  {p.chapter_no != null
                    ? `${t("reader.chapter")} ${p.chapter_no} — ${p.page_no}`
                    : String(p.page_no)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="label text-secondary-text">{t("reader.speed")}</span>
          <input
            type="range"
            min={0.75}
            max={1}
            step={0.05}
            value={speed}
            onChange={(e) => changeSpeed(Number(e.target.value))}
            aria-label={t("reader.speed")}
          />
          <span className="label tabular-nums">{formatSpeed(speed)}</span>
          {SPEEDS.map((v) => (
            <button
              key={v}
              type="button"
              className={btn}
              aria-pressed={Math.abs(speed - v) < 0.001}
              onClick={() => changeSpeed(v)}
            >
              {formatSpeed(v)}
            </button>
          ))}
        </div>

        {plainMissing ? (
          <p className="label text-secondary-text mt-2">{t("reader.noPlain")}</p>
        ) : null}
        {!page.has_audio ? (
          <p className="label text-secondary-text mt-2">{t("reader.noAudio")}</p>
        ) : null}
      </div>

      {chapters.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chapters.map((c) => (
            <button
              key={c.no}
              type="button"
              className={btn}
              onClick={() => setIndex(c.first)}
              aria-pressed={page.chapter_no === c.no}
            >
              {t("reader.chapter")} {c.no}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mx-auto mt-6" style={{ maxWidth: "65ch" }}>
        <p className="label text-secondary-text">
          {page.chapter_no != null ? `${t("reader.chapter")} ${page.chapter_no} · ` : ""}
          {t("reader.page")} {page.page_no}
        </p>

        {opensChapter ? (
          <header className="border-line mt-4 border-b pb-4">
            {page.chapter_title_he ? (
              <p
                dir="rtl"
                lang="he"
                style={{
                  fontFamily: "var(--font-hebrew)",
                  fontSize: "calc(24px * var(--text-scale))",
                  lineHeight: 1.7,
                  letterSpacing: "normal",
                }}
              >
                {page.chapter_title_he}
              </p>
            ) : null}
            {chapterTitle ? <p className="body-text mt-1">{chapterTitle}</p> : null}
          </header>
        ) : null}

        {page.blocks.map((b) => {
          const text = nikud ? b.he_nikud : b.he_plain;
          if (!(text ?? "").trim()) return null;
          return (
            <p
              key={b.id}
              dir="rtl"
              lang="he"
              style={{
                fontFamily: "var(--font-hebrew)",
                fontSize: "calc(21px * var(--text-scale))",
                lineHeight: 1.95,
                letterSpacing: "normal",
                marginTop: b.block_kind === "dialogue" ? "1.9em" : "1.3em",
              }}
            >
              {text}
            </p>
          );
        })}
      </div>
    </section>
  );
}
