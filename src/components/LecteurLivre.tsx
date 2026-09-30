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

  // Reprise : dernière page ouverte sur cet appareil (composant rendu côté navigateur seulement).
  const [index, setIndex] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = Number(window.localStorage.getItem(storeKey));
    return Math.max(0, pages.findIndex((p) => p.page_no === saved));
  });
  const [nikud, setNikud] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Map<string, { url: string; at: number }>());
  const autoRef = useRef(false); // la page affichée doit démarrer d'elle-même
  const page = pages[index];
  const textRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!goto) return;
    const i = pages.findIndex((p) => p.page_no === goto.pageNo);
    if (i >= 0) { autoRef.current = false; setIndex(i); }
  }, [goto, pages]);

  useEffect(() => {
    if (page) window.localStorage.setItem(storeKey, String(page.page_no));
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

  // Après tout changement de page, le texte revient à son début.
  const firstIndex = useRef(true);
  useEffect(() => {
    if (firstIndex.current) { firstIndex.current = false; return; }
    const el = textRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }, [index]);

  const openChapter = (no: number) => {
    const c = chapters.find((x) => x.chapter_no === no);
    const i = c?.first_page != null ? pages.findIndex((p) => p.page_no === c.first_page) : -1;
    if (i >= 0) { pause(); goIndex(i, false); }
  };

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

  const listed = chapters.filter((c) => c.pages.length);
  const chapLabel = (c: CompagnonChapter) => `${fmt(t("quiz.chapter"), { n: c.chapter_no })}${c.title ? ` · ${c.title}` : ""}`;

  return (
    <section className="select-none pb-48 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14" onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()} style={{ WebkitUserSelect: "none", userSelect: "none" }}>
      <aside className="hidden lg:block">
        <nav aria-label={t("reader.chapters")} className="sticky top-20 max-h-[calc(100dvh-14rem)] overflow-y-auto" data-chapter-list>
          <p className="label text-secondary-text">{t("reader.chapters")}</p>
          <ul className="border-line mt-3 border-l">
            {listed.map((c) => {
              const cur = c.chapter_no === page.chapter_no;
              return (
                <li key={c.chapter_no}>
                  <button type="button" onClick={() => openChapter(c.chapter_no)} aria-current={cur ? "true" : undefined}
                    className={`-ml-px block w-full border-l-2 py-2 pl-3 text-left text-[15px] leading-snug ${cur ? "border-collection font-bold" : "text-secondary-text hover:text-foreground border-transparent"}`}>
                    <span className="tabular-nums">{c.chapter_no}</span>{c.title ? ` · ${c.title}` : ""}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0">
      {retour ? (
        <button type="button" className="label touch mb-3 inline-flex items-center border-b border-current" onClick={retour.onClick}>← {retour.label}</button>
      ) : null}
      <audio ref={audioRef} preload="none"
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration || 0); setPitch(e.currentTarget); e.currentTarget.playbackRate = speed; }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)}
        onEnded={onEnded} onError={() => void onError()} />

      <select aria-label={t("reader.chapters")} data-chapter-select value={page.chapter_no}
        className="label border-line bg-background text-foreground mb-3 min-h-[44px] w-full border px-3 sm:w-auto lg:hidden"
        onChange={(e) => openChapter(Number(e.target.value))}>
        {listed.map((c) => <option key={c.chapter_no} value={c.chapter_no}>{chapLabel(c)}</option>)}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} disabled={plainMissing} aria-pressed={nikud} onClick={() => setNikud((v) => !v)} data-nikud={nikud ? "on" : "off"}>
          {t("reader.nikud")}
        </button>
        <label className="label flex items-center gap-2">
          <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} />
          {t("reader.autoAdvance")}
        </label>
      </div>
      {plainMissing ? <p className="label text-secondary-text mt-2">{t("reader.noPlain")}</p> : null}

      <div ref={textRef} className="mt-6 ml-auto scroll-mt-20" style={{ maxWidth: "62ch" }} data-page={page.page_no}>
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
      </div>

      {/* Barre fixe en deux lignes : les pages, puis l'audio. Alignée sur la colonne du texte dès 1024 px. */}
      <div className="bg-background border-line safe-bottom fixed inset-x-0 bottom-0 z-30 border-t pt-2" data-player>
        <div className="frame lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14">
          <div className="min-w-0 lg:col-start-2">
            <div className="grid grid-cols-[1fr_1.3fr_1fr] gap-2" data-page-row>
              <button type="button" className={`${btn} min-h-12`} disabled={index === 0} onClick={() => goIndex(index - 1, playing)} aria-label={t("reader.prevPage")} data-prev-page>
                ‹<span className="ml-1 hidden min-[420px]:inline">{t("reader.prevShort")}</span>
              </button>
              <select aria-label={t("reader.pagePicker")} data-where data-page-select value={page.page_no}
                className="label border-line bg-background text-foreground min-h-12 w-full border px-2 text-center tabular-nums"
                onChange={(e) => {
                  const i = pages.findIndex((p) => p.page_no === Number(e.target.value));
                  if (i >= 0) { pause(); goIndex(i, false); }
                }}>
                <option value={page.page_no} hidden>{fmt(t("reader.pageOf"), { p: page.page_no, n: pages.length })}</option>
                {listed.map((c) => (
                  <optgroup key={c.chapter_no} label={chapLabel(c)}>
                    {c.pages.map((pn) => <option key={pn} value={pn}>{fmt(t("reader.pageNo"), { p: pn })}</option>)}
                  </optgroup>
                ))}
              </select>
              <button type="button" className={`${btn} min-h-12`} disabled={index >= pages.length - 1} onClick={() => goIndex(index + 1, playing)} aria-label={t("reader.nextPage")} data-next-page>
                <span className="mr-1 hidden min-[420px]:inline">{t("reader.nextShort")}</span>›
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3 pb-2" data-audio-row>
              <button type="button" className={`${btn} shrink-0 min-w-[88px]`} disabled={!page.has_audio || loading} onClick={() => { autoRef.current = false; if (playing) pause(); else void play(); }} data-play>
                {loading ? "…" : playing ? t("reader.pause") : t("reader.play")}
              </button>
              <input type="range" min={0} max={duration || 0} step={0.1} value={Math.min(current, duration || 0)} disabled={!page.has_audio || !duration}
                onChange={(e) => { const el = audioRef.current; if (el) el.currentTime = Number(e.target.value); }}
                aria-label={t("reader.seek")} className="min-w-0 flex-1" />
              <span className="label text-secondary-text shrink-0 tabular-nums">
                {page.has_audio ? `${formatTime(current)} / ${formatTime(duration)}` : <span data-noaudio>{t("reader.noAudio")}</span>}
              </span>
              <select aria-label={t("reader.speed")} className="border-line touch label min-h-[44px] shrink-0 border bg-transparent px-2" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} data-speed>
                {SPEEDS.map((v) => <option key={v} value={v}>× {speedLabel(v)}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
