import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import { paragraphSupport, stageLabel, type ExcerptParagraph } from "@/lib/excerpt";

/**
 * La double page du livre, à ses proportions réelles (A5 × 2).
 * Hébreu à gauche, soutien à droite, sur la même trame : le paragraphe n
 * occupe la ligne n des deux côtés. Le soutien décroît jusqu'au blanc.
 * Aucune mécanique : c'est une page imprimée, réduite pour tenir à l'écran.
 */

const PAGE_W = 420; // 148 mm
const PAGE_H = 596; // 210 mm
const SPREAD_W = PAGE_W * 2;
const ROW_H = 57;

export function Spread({
  paragraphs,
  color = null,
  title,
  chapter,
  folio = 42,
  showStages = true,
}: {
  paragraphs: ExcerptParagraph[];
  color?: string | null;
  title: string;
  chapter: string;
  folio?: number;
  showStages?: boolean;
}) {
  const { lang } = useI18n();
  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / SPREAD_W));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (paragraphs.length === 0) return null;
  const rows = paragraphs.length;

  return (
    <div ref={holder} className="w-full overflow-hidden">
      <div
        style={{ height: PAGE_H * scale }}
        aria-label={`${title} — ${chapter}`}
        className="relative"
      >
        <div
          className="border-line absolute top-0 left-0 flex border"
          style={{
            width: SPREAD_W,
            height: PAGE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            boxShadow: "0 18px 36px -26px rgba(0,0,0,.55)",
          }}
        >
          {/* Page de gauche : l'hébreu */}
          <div
            className="border-line relative flex flex-col border-r"
            style={{ width: PAGE_W, height: PAGE_H, padding: "52px 46px 40px" }}
          >
            <p className="label text-secondary-text text-right" style={{ fontSize: 7 }}>
              {title}
            </p>
            <div
              className="mt-7 grid"
              style={{ gridTemplateRows: `repeat(${rows}, ${ROW_H}px)` }}
            >
              {paragraphs.map((p) => (
                <p
                  key={p.id}
                  dir="rtl"
                  lang="he"
                  className="text-right"
                  style={{
                    fontFamily: "var(--font-hebrew)",
                    fontSize: 15,
                    lineHeight: 1.95,
                    margin: 0,
                  }}
                >
                  {p.he}
                </p>
              ))}
            </div>
            <span
              className="text-secondary-text absolute"
              style={{ bottom: 26, left: 46, fontSize: 9 }}
            >
              {folio}
            </span>
          </div>

          {/* Page de droite : le soutien, qui se vide */}
          <div
            className="relative flex flex-col"
            style={{ width: PAGE_W, height: PAGE_H, padding: "52px 46px 40px" }}
          >
            <p className="label text-secondary-text" style={{ fontSize: 7 }}>
              {chapter}
            </p>
            <div
              className="mt-7 grid"
              style={{ gridTemplateRows: `repeat(${rows}, ${ROW_H}px)`, paddingTop: 10 }}
            >
              {paragraphs.map((p, i) => {
                const support = paragraphSupport(p, lang);
                const label = stageLabel(p, lang);
                return (
                  <div key={p.id} className="relative">
                    {showStages ? (
                      <span
                        className="absolute"
                        style={{
                          right: -30,
                          top: 2,
                          fontFamily: "var(--font-ui)",
                          fontSize: 7,
                          letterSpacing: "0.16em",
                          color: color ?? "var(--surface-muted)",
                        }}
                        title={label ?? undefined}
                      >
                        {i + 1}
                      </span>
                    ) : null}
                    {support ? (
                      <p
                        className="text-secondary-text"
                        style={{ fontSize: 10, lineHeight: 1.6, margin: 0 }}
                      >
                        {support}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <span
              className="text-secondary-text absolute"
              style={{ bottom: 26, right: 46, fontSize: 9 }}
            >
              {folio + 1}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
