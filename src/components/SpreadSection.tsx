import { useI18n } from "@/i18n/context";
import type { SpreadParagraph } from "@/lib/spread";
import { ExtraitLecture } from "./ExtraitLecture";

/** L'extrait lisible du site, précédé et suivi des mentions éditoriales. */
export function SpreadSection({
  paragraphs,
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
