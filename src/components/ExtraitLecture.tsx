import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { parseCloze, supportText, type SpreadParagraph } from "@/lib/spread";

/**
 * L'extrait tel que le visiteur du site le lit : une colonne, l'hébreu puis
 * son soutien juste en dessous. Pas de grille, pas de bandes, aucun
 * comblement vertical. Le fac-similé reste dans l'atelier.
 */

const VISIBLE = 4;

function Support({ paragraph }: { paragraph: SpreadParagraph }) {
  const { lang } = useI18n();
  const text = supportText(paragraph, lang);
  if (!text) return null;

  if (paragraph.support_kind === "nikud") {
    return (
      <p
        dir="rtl"
        lang="he"
        className="text-secondary-text text-right"
        style={{
          fontFamily: "var(--font-hebrew)",
          fontSize: "calc(17px * var(--text-scale))",
          lineHeight: 1.8,
          letterSpacing: "normal",
          textTransform: "none",
          marginTop: "0.4em",
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
        fontSize: "calc(15px * var(--text-scale))",
        lineHeight: 1.6,
        marginTop: "0.4em",
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

export function ExtraitLecture({ paragraphs }: { paragraphs: SpreadParagraph[] }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  if (paragraphs.length === 0) return null;

  const hasMore = paragraphs.length > VISIBLE;
  const shown = expanded || !hasMore ? paragraphs : paragraphs.slice(0, VISIBLE);

  return (
    <div className="mx-auto w-full" style={{ maxWidth: "65ch" }}>
      {shown.map((p, i) => (
        <div key={p.id} style={{ marginTop: i === 0 ? 0 : "1.6em" }}>
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
              margin: 0,
            }}
          >
            {p.he}
          </p>
          <Support paragraph={p} />
        </div>
      ))}

      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="label touch border-line mt-6 w-full border"
        >
          {expanded ? t("spread.less") : t("spread.more")}
        </button>
      ) : null}
    </div>
  );
}
