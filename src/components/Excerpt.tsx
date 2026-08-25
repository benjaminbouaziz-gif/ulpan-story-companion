import { useI18n } from "@/i18n/context";
import {
  glossarySense,
  paragraphSupport,
  stageLabel,
  type ExcerptParagraph,
  type GlossaryItem,
} from "@/lib/excerpt";

/**
 * L'extrait démonstratif : une seule colonne, du haut vers le bas, comme une
 * page du livre. Aucun contrôle, aucune animation, aucun vis-à-vis.
 */
export function Excerpt({
  paragraphs,
  color = null,
}: {
  paragraphs: ExcerptParagraph[];
  color?: string | null;
}) {
  const { t, lang } = useI18n();

  if (paragraphs.length === 0) {
    return <p className="body-text text-secondary-text">{t("excerpt.empty")}</p>;
  }

  return (
    <div className="mx-auto flex max-w-[65ch] flex-col gap-12">
      {paragraphs.map((p) => {
        const support = paragraphSupport(p, lang);
        const label = stageLabel(p, lang);
        return (
          <div key={p.id}>
            {label ? (
              <p
                className="mb-2 text-[10px] uppercase"
                style={{ color: color ?? undefined, letterSpacing: "0.18em", opacity: 0.55 }}
              >
                {p.stage_no} · {label}
              </p>
            ) : null}
            <p dir="rtl" lang="he" className="hebrew-lg text-right">
              {p.he}
            </p>
            {support ? (
              <p className="body-text text-secondary-text mt-3 ps-4 text-[0.85em]">{support}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Le glossaire est une liste, comme dans le livre. Jamais une bulle. */
export function GlossaryList({ items }: { items: GlossaryItem[] }) {
  const { lang } = useI18n();
  if (items.length === 0) return null;
  return (
    <dl className="mx-auto grid max-w-[65ch] grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="border-line border-b pb-2">
          <dt dir="rtl" lang="he" className="hebrew-sm text-right">
            {item.lemma_he}
          </dt>
          <dd className="body-text text-secondary-text text-[0.85em]">
            {glossarySense(item, lang)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
