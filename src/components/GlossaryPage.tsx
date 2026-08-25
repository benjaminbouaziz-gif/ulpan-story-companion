import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import { MM, glossarySense, type GlossaryWord } from "@/lib/book-page";

/**
 * La page de glossaire, telle qu'elle est imprimée en fin de livre : une page
 * A5, deux colonnes, un numéro par mot. Le prononcé est obligatoire : c'est lui
 * qui referme la boucle avec les trous — le lecteur qui bute sur
 * « Michtara (102) » doit retrouver au numéro 102 le mot écrit exactement
 * comme dans le trou.
 */

const CONTENT_MM = MM.pageW - MM.marginSide * 2;

export function GlossaryPage({
  words,
  color = null,
  maxPxPerMm = 3.78,
}: {
  words: GlossaryWord[];
  color?: string | null;
  maxPxPerMm?: number;
}) {
  const { t, lang } = useI18n();
  const holder = useRef<HTMLDivElement>(null);
  const [ppm, setPpm] = useState(maxPxPerMm);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setPpm(Math.min(maxPxPerMm, el.clientWidth / MM.pageW));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxPxPerMm]);

  if (words.length === 0) return null;
  const mm = (v: number) => `${v * ppm}px`;

  // Au triple du corps papier, le glossaire tient sur une seule colonne et
  // chaque colonne du tableau prend la largeur de son contenu.
  const columns = [words];
  const columnW = CONTENT_MM;

  const gridColumns = "max-content max-content max-content minmax(0,1fr)";

  return (
    <div ref={holder} className="w-full">
      <div
        className="relative"
        style={{
          width: mm(MM.pageW),
          minHeight: mm(MM.pageH),
          background: "#F3F1EA",
          color: "#15171A",
          paddingTop: mm(MM.marginTop),
          paddingLeft: mm(MM.marginSide),
          paddingRight: mm(MM.marginSide),
          paddingBottom: mm(MM.marginBottom),
          boxShadow: "0 18px 36px -26px rgba(0,0,0,.5)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-latin)",
            fontSize: mm(MM.chapterLatin),
            margin: 0,
          }}
        >
          {t("gloss.title")}
        </p>
        <p
          style={{
            fontFamily: "var(--font-latin)",
            fontSize: mm(MM.supportSize),
            lineHeight: MM.supportLine,
            marginTop: mm(2),
            marginBottom: mm(MM.chapterGap),
          }}
        >
          {t("gloss.note")}
        </p>

        <div style={{ display: "flex", gap: mm(MM.glossGutter) }}>
          {columns.map((col, ci) => (
            <div key={ci} style={{ width: mm(columnW) }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: gridColumns,
                  columnGap: mm(3),
                  fontFamily: "var(--font-ui)",
                  fontSize: mm(MM.keyNoSize),
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#6C6C66",
                  paddingBottom: mm(0.8),
                  borderBottom: `${Math.max(1, MM.glossHeadRule * ppm)}px solid rgba(21,23,26,.35)`,
                }}
              >
                <span>{t("gloss.no")}</span>
                <span>{t("gloss.he")}</span>
                <span>{t("gloss.translit")}</span>
                <span>{t("gloss.sense")}</span>
              </div>
              {col.map((w) => (
                <div
                  key={w.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridColumns,
                    columnGap: mm(3),
                    alignItems: "baseline",
                    paddingTop: mm(0.9),
                    paddingBottom: mm(0.9),
                    borderBottom: `${Math.max(1, MM.glossEntryRule * ppm)}px solid rgba(21,23,26,.14)`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: mm(MM.keyNoSize),
                      color: color ?? "#6C6C66",
                    }}
                  >
                    {w.gloss_no ?? ""}
                  </span>
                  <span
                    dir="rtl"
                    lang="he"
                    style={{
                      unicodeBidi: "isolate",
                      textAlign: "right",
                      fontFamily: "var(--font-hebrew)",
                      fontSize: mm(MM.glossHeSize),
                      letterSpacing: "normal",
                    }}
                  >
                    {w.he_nikud}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-latin)",
                      fontSize: mm(MM.glossBodySize),
                      fontStyle: "italic",
                    }}
                  >
                    {w.translit ?? ""}
                  </span>
                  <span
                    style={{ fontFamily: "var(--font-latin)", fontSize: mm(MM.glossBodySize) }}
                  >
                    {glossarySense(w, lang) ?? ""}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
