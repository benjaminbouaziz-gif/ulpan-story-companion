import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import { fmt } from "@/lib/fmt";
import { SPEEDS, usePreferences } from "@/lib/preferences";
import type { CompagnonChapter, CompagnonPage } from "@/lib/compagnon.functions";

/**
 * Le lecteur du compagnon. Texte toujours tiré de la base : he_nikud avec les
 * nekoudot, he_plain sans (jamais calculé). Audio par lien signé, renouvelé
 * s'il expire ; barre de lecture fixe en bas ; écran verrouillé via Media Session.
 */

const URL_TTL_MS = 13 * 60 * 1000; // liens de 15 min : on renouvelle avant l'échéance
const SKIP_DELAY_MS = 2500; // temps d'affichage d'une page sans audio pendant l'enchaînement

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
const speedLabel = (v: number) => String(v).replace(".", ",");

type Props = {
  editionId: string;
  editionTitle: string;
  coverUrl: string | null;
  pages: CompagnonPage[];
  chapters: CompagnonChapter[];
  requestAudioUrl: (pageId: string) => Promise<string | null>;
  /** Demande d'ouverture sur une page (« Relire la page N »). */
  goto?: { pageNo: number; n: number } | undefined;
  retour?: { label: string; onClick: () => void } | undefined;
};

function setPitch(el: HTMLAudioElement) {
  const a = el as HTMLAudioElement & { preservesPitch?: boolean; mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean };
  a.preservesPitch = true;
  a.mozPreservesPitch = true;
  a.webkitPreservesPitch = true;
}

export function LecteurLivre({ editionId, editionTitle, coverUrl, pages, chapters, requestAudioUrl, goto, retour }: Props) {
  const { t } = useI18n();
  const { speed, setSpeed, autoAdvance, setAutoAdvance } = usePreferences();
  const storeKey = `ulpanstory.page.${editionId}`;

  const [index, setIndex] = useState(0);
  const [nikud, setNikud] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sommaire, setSommaire] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Map<string, { url: string; at: number }>());
  const autoRef = useRef(false); // la page affichée doit démarrer d'elle-même
  const page = pages[index];

  // Reprise : dernière page ouverte sur cet appareil.
  const restored = useRef(false);
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(storeKey));
    const i = pages.findIndex((p) => p.page_no === saved);
    if (i >= 0) setIndex(i);
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);

  useEffect(() => {
    if (!goto) return;
    const i = pages.findIndex((p) => p.page_no === goto.pageNo);
    if (i >= 0) { autoRef.current = false; setIndex(i); }
  }, [goto, pages]);

  useEffect(() => {
    // Rien n'est écrit avant la reprise, sinon la page 1 écraserait la page retenue.
    if (page && restored.current) window.localStorage.setItem(storeKey, String(page.page_no));
  }, [page, storeKey]);

  const plainMissing = useMemo(() => !page || page.paragraphs.length === 0 || page.paragraphs.some((b) => !(b.he_plain ?? "").trim()), [page]);
  useEffect(() => { if (plainMissing) setNikud(true); }, [plainMissing]);

  const urlFor = useCallback(async (pageId: string, force = false) => {
    const c = urls.current.get(pageId);
    if (!force && c && Date.now() - c.at < URL_TTL_MS) return c.url;
    const url = await requestAudioUrl(pageId);
    if (url) urls.current.set(pageId, { url, at: Date.now() });
    return url;
  }, [requestAudioUrl]);

  const play = useCallback(async () => {
    const el = audioRef.current;
    if (!el || !page?.has_audio) return;
    const c = urls.current.get(page.id);
    if (!el.getAttribute("src") || !c || Date.now() - c.at >= URL_TTL_MS) {
      setLoading(true);
      const pos = el.getAttribute("src") ? el.currentTime : 0;
      const url = await urlFor(page.id).catch(() => null);
      setLoading(false);
      if (!url) return;
      if (el.src !== url) { el.src = url; if (pos) el.currentTime = pos; }
    }
    setPitch(el);
    el.playbackRate = speed;
    try { await el.play(); setPlaying(true); } catch { setPlaying(false); }
  }, [page, speed, urlFor]);

  const pause = useCallback(() => { audioRef.current?.pause(); setPlaying(false); }, []);

  const goIndex = useCallback((i: number, keepPlaying: boolean) => {
    if (i < 0 || i >= pages.length) return;
    autoRef.current = keepPlaying;
    setIndex(i);
  }, [pages.length]);

  // Changement de page : nouvelle source ; démarre si l'enchaînement ou la lecture en cours le demande.
  useEffect(() => {
    const el = audioRef.current;
    if (el) { el.pause(); el.removeAttribute("src"); el.load(); }
    setPlaying(false); setCurrent(0); setDuration(0);
    if (!autoRef.current || !page) return;
    if (page.has_audio) { void play(); return; }
    if (!autoAdvance) { autoRef.current = false; return; }
    const timer = window.setTimeout(() => {
      const next = pages.findIndex((p, i) => i > index && p.has_audio);
      if (next >= 0) goIndex(next, true); else autoRef.current = false;
    }, SKIP_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => { const el = audioRef.current; if (el) { setPitch(el); el.playbackRate = speed; } }, [speed]);

  const onEnded = () => {
    setPlaying(false);
    if (autoAdvance && index < pages.length - 1) goIndex(index + 1, true);
    else autoRef.current = false;
  };

  // Lien expiré pendant l'écoute : on en redemande un et on reprend au même endroit.
  const onError = async () => {
    const el = audioRef.current;
    if (!el || !page?.has_audio || !el.getAttribute("src")) return;
    // Lien tout juste obtenu : ce n'est pas une expiration, on n'insiste pas.
    const c = urls.current.get(page.id);
    if (c && Date.now() - c.at < 30_000) { setPlaying(false); autoRef.current = false; return; }
    const pos = el.currentTime;
    const url = await urlFor(page.id, true).catch(() => null);
    if (!url) return;
    el.src = url;
    el.currentTime = pos;
    if (playing) { try { await el.play(); } catch { setPlaying(false); } }
  };

  const where = page ? fmt(t("reader.where"), { c: page.chapter_no, p: page.page_no }) : "";

  // Écran verrouillé / arrière-plan.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !page) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({ title: editionTitle, artist: where, album: "Ulpan Story", artwork: coverUrl ? [{ src: coverUrl, sizes: "512x512" }] : [] });
      ms.setActionHandler("play", () => { autoRef.current = false; void play(); });
      ms.setActionHandler("pause", pause);
      ms.setActionHandler("previoustrack", () => goIndex(index - 1, playing));
      ms.setActionHandler("nexttrack", () => goIndex(index + 1, playing));
    } catch { /* navigateur sans Media Session complète */ }
  }, [page, index, playing, editionTitle, coverUrl, where, play, pause, goIndex]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  if (!page) return null;

  const chap = chapters.find((c) => c.chapter_no === page.chapter_no);
  const opensChapter = chap?.first_page === page.page_no && Boolean(chap?.title_he || chap?.title);
  const btn = "border-line label touch inline-flex min-h-[44px] min-w-[44px] items-center justify-center border px-3 disabled:opacity-40";
  const heb = { fontFamily: "var(--font-hebrew)", letterSpacing: "normal", textTransform: "none" } as const;

  return (
    <section className="select-none pb-56" onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()} style={{ WebkitUserSelect: "none", userSelect: "none" }}>
      {retour ? (
        <button type="button" className="label touch mb-3 inline-flex items-center border-b border-current" onClick={retour.onClick}>← {retour.label}</button>
      ) : null}
      <audio ref={audioRef} preload="none"
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration || 0); setPitch(e.currentTarget); e.currentTarget.playbackRate = speed; }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)}
        onEnded={onEnded} onError={() => void onError()} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => setSommaire(true)}>{t("reader.chapters")}</button>
        <button type="button" className={btn} disabled={plainMissing} aria-pressed={nikud} onClick={() => setNikud((v) => !v)} data-nikud={nikud ? "on" : "off"}>
          {t("reader.nikud")}
        </button>
        <label className="label flex items-center gap-2">
          <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} />
          {t("reader.autoAdvance")}
        </label>
      </div>
      {plainMissing ? <p className="label text-secondary-text mt-2">{t("reader.noPlain")}</p> : null}

      <div className="mx-auto mt-6" style={{ maxWidth: "65ch" }} data-page={page.page_no}>
        {opensChapter ? (
          <header className="border-line border-b pb-4">
            {chap?.title_he ? <p dir="rtl" lang="he" style={{ ...heb, fontSize: "calc(24px * var(--text-scale))", lineHeight: 1.7 }}>{chap.title_he}</p> : null}
            {chap?.title ? <p className="body-text mt-1">{chap.title}</p> : null}
          </header>
        ) : null}
        {page.paragraphs.map((b) => {
          const text = nikud ? b.he_nikud : b.he_plain;
          if (!(text ?? "").trim()) return null;
          return (
            <p key={b.id} dir="rtl" lang="he" style={{ ...heb, fontSize: "calc(21px * var(--text-scale))", lineHeight: 1.95, marginTop: b.kind === "dialogue" ? "1.9em" : "1.3em" }}>{text}</p>
          );
        })}
      </div>

      {/* Barre de lecture fixe, au-dessus de la zone de sécurité du téléphone. */}
      <div className="bg-background border-line safe-bottom fixed inset-x-0 bottom-0 z-30 border-t px-3 pt-2" data-player>
        <div className="mx-auto w-full max-w-3xl">
          <input type="range" min={0} max={duration || 0} step={0.1} value={Math.min(current, duration || 0)} disabled={!page.has_audio || !duration}
            onChange={(e) => { const el = audioRef.current; if (el) el.currentTime = Number(e.target.value); }}
            aria-label={t("reader.seek")} className="block w-full" />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="label tabular-nums" data-where>{where}</span>
            <span className="label text-secondary-text tabular-nums">
              {page.has_audio ? `${formatTime(current)} / ${formatTime(duration)}` : <span data-noaudio>{t("reader.noAudio")}</span>}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 pb-2">
            <button type="button" className={btn} disabled={index === 0} onClick={() => goIndex(index - 1, playing)} aria-label={t("reader.prevPage")}>‹‹</button>
            <button type="button" className={`${btn} min-w-[96px]`} disabled={!page.has_audio || loading} onClick={() => { autoRef.current = false; if (playing) pause(); else void play(); }} data-play>
              {loading ? "…" : playing ? t("reader.pause") : t("reader.play")}
            </button>
            <button type="button" className={btn} disabled={index >= pages.length - 1} onClick={() => goIndex(index + 1, playing)} aria-label={t("reader.nextPage")}>››</button>
            <select aria-label={t("reader.speed")} className="border-line touch label min-h-[44px] border bg-transparent px-2" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} data-speed>
              {SPEEDS.map((v) => <option key={v} value={v}>× {speedLabel(v)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {sommaire ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button type="button" aria-label={t("nav.close")} onClick={() => setSommaire(false)} className="bg-foreground/40 absolute inset-0" />
          <div className="bg-background border-line safe-bottom relative max-h-[80vh] overflow-y-auto border-t px-4 pt-4">
            <div className="mx-auto w-full max-w-xl">
              <p className="label text-secondary-text">{t("reader.chapters")}</p>
              <ul className="mt-2">
                {chapters.filter((c) => c.pages.length).map((c) => (
                  <li key={c.chapter_no} className="border-line border-b py-3">
                    <p className="body-text">{fmt(t("quiz.chapter"), { n: c.chapter_no })}{c.title ? ` · ${c.title}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.pages.map((n) => (
                        <button key={n} type="button" className={btn} aria-current={n === page.page_no} onClick={() => { goIndex(pages.findIndex((p) => p.page_no === n), false); setSommaire(false); }}>{n}</button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setSommaire(false)} className="label touch bg-foreground text-background mt-4 mb-2 w-full">{t("nav.close")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
