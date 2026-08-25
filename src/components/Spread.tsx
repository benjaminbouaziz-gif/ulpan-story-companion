import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import {
  MM,
  baselineOffsetMm,
  parseCloze,
  supportText,
  type SpreadParagraph,
} from "@/lib/spread";

/**
 * La double page du livre, reproduite au millimètre : A5 × 2, marges réelles,
 * typographies réelles. Les deux colonnes sont des grilles au même pas de
 * 24 mm : le paragraphe n de gauche occupe la bande n de droite par
 * construction. Aucune mécanique d'interface : c'est du papier.
 */

const SPREAD_MM = MM.pageW * 2;

function SupportBlock({
  paragraph,
  mm,
}: {
  paragraph: SpreadParagraph;
  mm: (v: number) => string;
}) {
  const { lang } = useI18n();
  const text = supportText(paragraph, lang);
  if (!text) return null;

  if (paragraph.support_kind === "nikud") {
    return (
      <p
        dir="rtl"
        lang="he"
        className="text-right"
        style={{
          fontFamily: "var(--font-hebrew)",
          fontSize: mm(MM.supportHeSize),
          lineHeight: MM.supportHeLine,
          letterSpacing: "normal",
          textTransform: "none",
          margin: 0,
        }}
      >
        {text}
      </p>
    );
  }

  return (
    <p
      className="text-secondary-text"
      style={{
        fontFamily: "var(--font-latin)",
        fontSize: mm(MM.supportSize),
        lineHeight: MM.supportLine,
        margin: 0,
      }}
    >
      {paragraph.support_kind === "cloze"
        ? parseCloze(text).map((piece, i) =>
            piece.cloze ? (
              <em key={i} style={{ fontStyle: "italic" }}>
                {piece.text}
              </em>
            ) : (
              <span key={i}>{piece.text}</span>
            ),
          )
        : text}
    </p>
  );
}

export function Spread({
  paragraphs,
  color = null,
  runningHead,
  chapter,
  folio = 42,
  showGrid = false,
  maxPxPerMm = 3.78,
}: {
  paragraphs: SpreadParagraph[];
  color?: string | null;
  runningHead: string;
  chapter: string;
  folio?: number;
  showGrid?: boolean;
  maxPxPerMm?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [ppm, setPpm] = useState(maxPxPerMm);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setPpm(Math.min(maxPxPerMm, el.clientWidth / SPREAD_MM));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxPxPerMm]);

  if (paragraphs.length === 0) return null;

  const mm = (v: number) => `${v * ppm}px`;
  const rows = paragraphs.length;
  const bands = Array.from({ length: rows }, (_, i) => i);
  const gridTop = MM.marginTop + MM.runheadSize * 1.2 + MM.runheadGap;

  const gridOverlay = showGrid ? (
    <div className="pointer-events-none absolute inset-0">
      {bands.map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: mm(gridTop + i * MM.band),
            height: 1,
            background: "rgba(22,64,122,.35)",
          }}
        />
      ))}
    </div>
  ) : null;

  return (
    <div ref={holder} className="w-full">
      <div
        className="relative flex"
        style={{
          width: mm(SPREAD_MM),
          height: mm(MM.pageH),
          background: "#F3F1EA",
          color: "#15171A",
          boxShadow: "0 18px 36px -26px rgba(0,0,0,.5)",
        }}
      >
        {/* Page de gauche : l'hébreu */}
        <div
          className="relative"
          style={{
            width: mm(MM.pageW),
            height: mm(MM.pageH),
            paddingTop: mm(MM.marginTop),
            paddingLeft: mm(MM.marginSide),
            paddingRight: mm(MM.marginSide),
            paddingBottom: mm(MM.marginBottom),
          }}
        >
          <p
            className="text-right"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: mm(MM.runheadSize),
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#6C6C66",
              margin: 0,
            }}
          >
            {runningHead}
          </p>
          <div
            className="grid"
            style={{
              marginTop: mm(MM.runheadGap),
              gridTemplateRows: `repeat(${rows}, ${mm(MM.band)})`,
            }}
          >
            {paragraphs.map((p) => (
              <p
                key={p.id}
                dir="rtl"
                lang="he"
                className="text-right"
                style={{
                  fontFamily: "var(--font-hebrew)",
                  fontSize: mm(MM.hebrewSize),
                  lineHeight: MM.hebrewLine,
                  letterSpacing: "normal",
                  textTransform: "none",
                  fontStretch: "normal",
                  margin: 0,
                }}
              >
                {p.he}
              </p>
            ))}
          </div>
          <span
            style={{
              position: "absolute",
              bottom: mm(MM.folioBottom),
              left: mm(MM.marginSide),
              fontFamily: "var(--font-latin)",
              fontSize: mm(MM.folioSize),
              color: "#6C6C66",
            }}
          >
            {folio}
          </span>
          {gridOverlay}
        </div>

        {/* Filet de pliure */}
        <div
          style={{
            width: Math.max(1, 0.3 * ppm),
            height: "100%",
            background: "rgba(21,23,26,.10)",
          }}
        />

        {/* Page de droite : le soutien */}
        <div
          className="relative"
          style={{
            width: mm(MM.pageW),
            height: mm(MM.pageH),
            paddingTop: mm(MM.marginTop),
            paddingLeft: mm(MM.marginSide),
            paddingRight: mm(MM.marginSide),
            paddingBottom: mm(MM.marginBottom),
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: mm(MM.runheadSize),
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#6C6C66",
              margin: 0,
            }}
          >
            {chapter}
          </p>
          <div
            className="grid"
            style={{
              marginTop: mm(MM.runheadGap),
              gridTemplateRows: `repeat(${rows}, ${mm(MM.band)})`,
            }}
          >
            {paragraphs.map((p, i) => (
              <div key={p.id} style={{ paddingTop: mm(baselineOffsetMm(p.support_kind)) }}>
                <SupportBlock paragraph={p} mm={mm} />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    right: mm(MM.stageInset),
                    top: mm(gridTop + i * MM.band),
                    width: mm(MM.stageWidth),
                    textAlign: "center",
                    fontFamily: "var(--font-ui)",
                    fontSize: mm(MM.stageSize),
                    color: color ?? "#6C6C66",
                  }}
                >
                  {p.stage_no}
                </span>
              </div>
            ))}
          </div>
          <span
            style={{
              position: "absolute",
              bottom: mm(MM.folioBottom),
              right: mm(MM.marginSide),
              fontFamily: "var(--font-latin)",
              fontSize: mm(MM.folioSize),
              color: "#6C6C66",
            }}
          >
            {folio + 1}
          </span>
          {gridOverlay}
        </div>
      </div>
    </div>
  );
}
