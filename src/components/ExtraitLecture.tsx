import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { parseCloze, supportText, type SpreadParagraph } from "@/lib/spread";

const INITIAL_PARAGRAPHS = 4;

/**
 * L'extrait du site : chaque paragraphe hébreu reste uni à son soutien,
 * sans reprendre les dimensions ni la grille de la page imprimée.
 */
export function ExtraitLecture({ paragraphs }: { paragraphs: SpreadParagraph[] }) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);

  if (paragraphs.length === 0) return null;

  const ordered = [...paragraphs].sort((a, b) => a.sort_order - b.sort_order);
  const visible = expanded ? ordered : ordered.slice(0, INITIAL_PARAGRAPHS);
  const canExpand = ordered.length > INITIAL_PARAGRAPHS;

  return (
    <div className="mx-auto w-full max-w-[65ch]">
      {visible.map((paragraph, index) => {
        const support = supportText(paragraph, lang);
        return (
          <div key={paragraph.id} className={index === 0 ? "" : "mt-[1.6em]"}>
            <p
              dir="rtl"
              lang="he"
              className="text-right"
              style={{
                fontFamily: "var(--font-hebrew)",
                fontSize: "calc(21px * var(--text-scale))",
                lineHeight: 1.95,
                letterSpacing: "normal",
                textTransform: "none",
                fontStretch: "normal",
              }}
            >
              {paragraph.he}
            </p>

            {support ? (
              paragraph.support_kind === "nikud" ? (
                <p
                  dir="rtl"
                  lang="he"
                  className="text-secondary-text mt-[0.4em] text-right"
                  style={{
                    fontFamily: "var(--font-hebrew)",
                    fontSize: "calc(15px * var(--text-scale))",
                    lineHeight: 1.6,
                    letterSpacing: "normal",
                    textTransform: "none",
                    fontStretch: "normal",
                  }}
                >
                  {support}
                </p>
              ) : (
                <p
                  className="text-secondary-text mt-[0.4em]"
                  style={{ fontSize: "calc(15px * var(--text-scale))", lineHeight: 1.6 }}
                >
                  {paragraph.support_kind === "cloze"
                    ? parseCloze(support).map((piece, pieceIndex) =>
                        piece.cloze ? (
                          <em key={pieceIndex} className="italic">
                            {piece.text}
                          </em>
                        ) : (
                          <span key={pieceIndex}>{piece.text}</span>
                        ),
                      )
                    : support}
                </p>
              )
            ) : null}
          </div>
        );
      })}

      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="label touch mt-8 border-b border-current"
          aria-expanded={expanded}
        >
          {expanded ? t("excerpt.collapse") : t("excerpt.readMore")}
        </button>
      ) : null}
    </div>
  );
}