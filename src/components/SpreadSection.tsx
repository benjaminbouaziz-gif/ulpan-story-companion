import { useI18n } from "@/i18n/context";
import type { SpreadParagraph } from "@/lib/spread";
import { ExtraitLecture } from "./ExtraitLecture";

/**
 * L'extrait sur le site : l'affirmation, l'extrait de lecture en une colonne,
 * puis la mention de démonstration. Le fac-similé reste dans l'atelier.
 */
export function SpreadSection({
  paragraphs,
  claim,
  note,
}: {
  paragraphs: SpreadParagraph[];
  /** null pour ne rien afficher ; undefined pour la phrase par défaut. */
  claim?: string | null;
  note?: string | null;
}) {
  const { t } = useI18n();

  if (paragraphs.length === 0) return null;

  const claimText = claim === undefined ? t("spread.claim") : claim;
  const noteText = note === undefined ? t("spread.note") : note;

  return (
    <section className="mt-8">
      {claimText ? (
        <p style={{ fontSize: "calc(19px * var(--text-scale))", lineHeight: 1.55 }}>{claimText}</p>
      ) : null}

      <div className="mt-8">
        <ExtraitLecture paragraphs={paragraphs} />
      </div>

      {noteText ? <p className="label text-secondary-text mt-4">{noteText}</p> : null}
    </section>
  );
}
