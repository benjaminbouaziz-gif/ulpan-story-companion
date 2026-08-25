import { useCallback, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import {
  LEVEL_HINTS,
  LEVEL_LABELS,
  SUPPORT_LEVELS,
  levelShows,
  segmentHardWords,
  segmentSupport,
  splitSupport,
  stripNikud,
  tokenGloss,
  tokenHebrew,
  tokenNote,
  type MirrorSegment,
  type MirrorToken,
  type SupportLevel,
} from "@/lib/segments";
import { HebrewText } from "./HebrewText";

type Active = { segmentId: string; tokenIndex: number } | null;

/**
 * Le miroir. À gauche (au-dessus sur mobile) l'hébreu vocalisé, à droite
 * (en dessous) le soutien. Toucher un mot allume son reflet dans la
 * traduction. Le curseur retire le soutien cran par cran.
 */
export function MirrorReader({
  segments,
  color,
  initialLevel = 1,
  showSlider = true,
}: {
  segments: MirrorSegment[];
  color?: string | null;
  initialLevel?: SupportLevel;
  showSlider?: boolean;
}) {
  const { lang, t } = useI18n();
  const [level, setLevel] = useState<SupportLevel>(initialLevel);
  const [active, setActive] = useState<Active>(null);
  const [sheet, setSheet] = useState<MirrorToken | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const shows = levelShows(level);
  const accent = color ?? "var(--on-surface)";

  const startPress = useCallback((token: MirrorToken) => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setSheet(token);
    }, 450);
  }, []);

  const endPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }, []);

  const onTokenClick = useCallback(
    (segmentId: string, tokenIndex: number, token: MirrorToken) => {
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      // Sans traduction sur la page, toucher un mot ouvre directement le glossaire.
      if (!shows.sentence && !shows.wordByWord) {
        setSheet(token);
        return;
      }
      setActive((prev) =>
        prev && prev.segmentId === segmentId && prev.tokenIndex === tokenIndex
          ? null
          : { segmentId, tokenIndex },
      );
    },
    [shows.sentence, shows.wordByWord],
  );

  if (segments.length === 0) {
    return <p className="body-text text-secondary-text">{t("mirror.empty")}</p>;
  }

  return (
    <div>
      {showSlider ? (
        <SupportSlider level={level} onChange={setLevel} accent={accent} />
      ) : null}

      <div className="mt-6 flex flex-col gap-6">
        {segments.map((segment) => (
          <SegmentBlock
            key={segment.id}
            segment={segment}
            level={level}
            accent={accent}
            active={active}
            onTokenClick={onTokenClick}
            onPressStart={startPress}
            onPressEnd={endPress}
            onSupportClick={(tokenIndex) =>
              setActive((prev) =>
                prev && prev.segmentId === segment.id && prev.tokenIndex === tokenIndex
                  ? null
                  : { segmentId: segment.id, tokenIndex },
              )
            }
          />
        ))}
      </div>

      {sheet ? <GlossarySheet token={sheet} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}

function SupportSlider({
  level,
  onChange,
  accent,
}: {
  level: SupportLevel;
  onChange: (l: SupportLevel) => void;
  accent: string;
}) {
  const { lang, t } = useI18n();
  return (
    <div className="border-line border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label text-secondary-text">{t("mirror.support")}</p>
        <p className="label" style={{ color: accent }}>
          {level}/6 · {LEVEL_LABELS[lang][level]}
        </p>
      </div>
      <input
        type="range"
        min={1}
        max={6}
        step={1}
        value={level}
        aria-label={t("mirror.support")}
        onChange={(e) => onChange(Number(e.target.value) as SupportLevel)}
        className="mt-3 h-11 w-full"
        style={{ accentColor: accent }}
      />
      <div className="flex justify-between">
        {SUPPORT_LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            aria-label={LEVEL_LABELS[lang][l]}
            aria-pressed={l === level}
            className="label touch text-secondary-text flex flex-1 items-center justify-center"
          >
            {l}
          </button>
        ))}
      </div>
      <p className="body-text text-secondary-text mt-2">{LEVEL_HINTS[lang][level]}</p>
    </div>
  );
}

function SegmentBlock({
  segment,
  level,
  accent,
  active,
  onTokenClick,
  onPressStart,
  onPressEnd,
  onSupportClick,
}: {
  segment: MirrorSegment;
  level: SupportLevel;
  accent: string;
  active: Active;
  onTokenClick: (segmentId: string, tokenIndex: number, token: MirrorToken) => void;
  onPressStart: (token: MirrorToken) => void;
  onPressEnd: () => void;
  onSupportClick: (tokenIndex: number) => void;
}) {
  const { lang, t } = useI18n();
  const shows = levelShows(level);
  const activeIndex = active && active.segmentId === segment.id ? active.tokenIndex : null;
  const support = segmentSupport(segment, lang);
  const hard = segmentHardWords(segment, lang);
  const tokens = segment.tokens;

  const pieces = useMemo(
    () => (support && shows.sentence ? splitSupport(support, tokens, lang) : []),
    [support, shows.sentence, tokens, lang],
  );

  const highlight = (on: boolean) =>
    on ? { backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)` } : undefined;

  return (
    <article className="border-line border">
      <div className="p-4 lg:grid lg:grid-cols-2 lg:gap-6">
        {/* Page de gauche : l'hébreu. */}
        <div dir="rtl" lang="he" className="text-right">
          {tokens.length === 0 ? (
            <HebrewText>{shows.plainHebrew ? segment.he_plain : segment.he_nikud}</HebrewText>
          ) : (
            <p className="hebrew">
              {tokens.map((token, i) => (
                <span key={`${segment.id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onTokenClick(segment.id, i, token)}
                    onPointerDown={() => onPressStart(token)}
                    onPointerUp={onPressEnd}
                    onPointerLeave={onPressEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`hebrew px-[2px] ${
                      shows.hardWords && token.is_hard ? "underline decoration-dotted" : ""
                    }`}
                    style={highlight(activeIndex === i)}
                  >
                    {tokenHebrew(token, shows.plainHebrew)}
                  </button>{" "}
                </span>
              ))}
            </p>
          )}
        </div>

        {/* Page de droite : le soutien, qui se retire. */}
        <div className="border-line mt-4 border-t pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          {shows.sentence && support ? (
            <p className="body-text">
              {pieces.length === 0
                ? support
                : pieces.map((piece, i) =>
                    piece.tokenIndex === null ? (
                      <span key={i}>{piece.text}</span>
                    ) : (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onSupportClick(piece.tokenIndex!)}
                        className="text-left"
                        style={highlight(activeIndex === piece.tokenIndex)}
                      >
                        {piece.text}
                      </button>
                    ),
                  )}
            </p>
          ) : null}

          {shows.wordByWord ? (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {tokens.map((token, i) => {
                const gloss = tokenGloss(token, lang);
                if (!gloss) return null;
                return (
                  <li
                    key={`${segment.id}-w-${i}`}
                    className="label text-secondary-text"
                    style={highlight(activeIndex === i)}
                  >
                    <span dir="rtl" lang="he" className="not-italic">
                      {token.he_nikud}
                    </span>{" "}
                    — {gloss}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {shows.hardWords && hard ? (
            <p className="body-text text-secondary-text" dir="ltr">
              {hard}
            </p>
          ) : null}

          {!shows.sentence && !shows.hardWords ? (
            <p className="label text-secondary-text">{t("mirror.tapForGlossary")}</p>
          ) : null}

          {segment.translit && level <= 2 ? (
            <p className="label text-secondary-text mt-3">{segment.translit}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function GlossarySheet({ token, onClose }: { token: MirrorToken; onClose: () => void }) {
  const { lang, t } = useI18n();
  const gloss = tokenGloss(token, lang);
  const note = tokenNote(token, lang);
  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={t("nav.close")}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40"
      />
      <div className="border-line bg-background safe-bottom relative w-full border-t px-4 pt-4">
        <div className="mx-auto w-full max-w-3xl">
          <p className="label text-secondary-text">{t("mirror.glossary")}</p>
          <HebrewText size="lg" className="mt-2">
            {token.he_nikud}
          </HebrewText>
          <p className="label text-secondary-text mt-1">{stripNikud(token.he_nikud)}</p>
          {token.translit ? <p className="body-text mt-2 italic">{token.translit}</p> : null}
          <p className="body-text mt-3">{gloss ?? t("mirror.noGloss")}</p>
          {note ? <p className="body-text text-secondary-text mt-2">{note}</p> : null}
          <button
            type="button"
            onClick={onClose}
            className="label touch border-line mt-4 mb-2 w-full border"
          >
            {t("nav.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
