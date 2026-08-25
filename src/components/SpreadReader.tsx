import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { parseCloze, supportText, type SpreadParagraph } from "@/lib/spread";

/**
 * Écran 2 au téléphone : la lecture en grand, une étape à l'écran.
 * On avance par bouton — un balayage horizontal entrerait en conflit avec
 * le défilement d'un texte RTL.
 */
export function SpreadReader({
  paragraphs,
  color = null,
}: {
  paragraphs: SpreadParagraph[];
  color?: string | null;
}) {
  const { t, lang } = useI18n();
  const [index, setIndex] = useState(0);
  if (paragraphs.length === 0) return null;

  const p = paragraphs[Math.min(index, paragraphs.length - 1)]!;
  const support = supportText(p, lang);
  const isHebrewSupport = p.support_kind === "nikud";

  return (
    <div className="mx-auto max-w-[65ch]">
      <p className="label" style={{ color: color ?? undefined }}>
        {t("spread.stage")} {p.stage_no} {t("spread.of")} {paragraphs.length}
      </p>

      <p
        dir="rtl"
        lang="he"
        className="mt-4 text-right"
        style={{
          fontFamily: "var(--font-hebrew)",
          fontSize: "calc(26px * var(--text-scale))",
          lineHeight: 1.9,
          letterSpacing: "normal",
        }}
      >
        {p.he}
      </p>

      {support ? (
        isHebrewSupport ? (
          <p
            dir="rtl"
            lang="he"
            className="text-secondary-text mt-5 text-right"
            style={{
              fontFamily: "var(--font-hebrew)",
              fontSize: "calc(22px * var(--text-scale))",
              lineHeight: 1.9,
              letterSpacing: "normal",
            }}
          >
            {support}
          </p>
        ) : (
          <p className="body-text text-secondary-text mt-5">
            {p.support_kind === "cloze"
              ? parseCloze(support).map((piece, i) =>
                  piece.cloze ? (
                    <em key={i} className="italic">
                      {piece.text}
                    </em>
                  ) : (
                    <span key={i}>{piece.text}</span>
                  ),
                )
              : support}
          </p>
        )
      ) : null}

      <div className="border-line mt-8 flex gap-3 border-t pt-4">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="label touch border-line flex-1 border disabled:opacity-40"
        >
          {t("spread.prev")}
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(paragraphs.length - 1, i + 1))}
          disabled={index >= paragraphs.length - 1}
          className="label touch bg-foreground text-background flex-1 disabled:opacity-40"
        >
          {t("spread.next")}
        </button>
      </div>
    </div>
  );
}
