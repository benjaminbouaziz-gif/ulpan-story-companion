import { useState } from "react";
import { useI18n } from "@/i18n/context";
import type { SpreadParagraph } from "@/lib/spread";
import { Spread } from "./Spread";
import { SpreadReader } from "./SpreadReader";

/**
 * La double page sur le site : l'affirmation, la page, la mention de
 * démonstration, puis la lecture en grand. Aucun texte ne décrit ce que la
 * double page montre.
 */
export function SpreadSection({
  paragraphs,
  color = null,
  runningHead,
  chapter,
  folio = 42,
  claim,
  note,
}: {
  paragraphs: SpreadParagraph[];
  color?: string | null;
  runningHead: string;
  chapter: string;
  folio?: number;
  /** null pour ne rien afficher ; undefined pour la phrase par défaut. */
  claim?: string | null;
  note?: string | null;
}) {
  const { t } = useI18n();
  const [reading, setReading] = useState(false);

  if (paragraphs.length === 0) return null;

  const claimText = claim === undefined ? t("spread.claim") : claim;
  const noteText = note === undefined ? t("spread.note") : note;

  return (
    <section className="mt-8">
      {claimText ? (
        <p style={{ fontSize: "calc(19px * var(--text-scale))", lineHeight: 1.55 }}>
          {claimText}
        </p>
      ) : null}

      <div className="mt-8">
        <Spread
          paragraphs={paragraphs}
          color={color}
          runningHead={runningHead}
          chapter={chapter}
          folio={folio}
        />
      </div>

      {noteText ? <p className="label text-secondary-text mt-4">{noteText}</p> : null}


      {reading ? (
        <div className="border-line mt-8 border-t pt-8">
          <SpreadReader paragraphs={paragraphs} color={color} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setReading(true)}
          className="label touch bg-foreground text-background mt-6 w-full"
        >
          {t("spread.readBig")}
        </button>
      )}
    </section>
  );
}
