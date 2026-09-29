import { useI18n } from "@/i18n/context";
import { SiteLink } from "@/components/SiteLink";
import type { VCard } from "@/lib/vitrine.data";

/** Grille de couvertures : 2 colonnes sous 640 px, 3 jusqu'à 1024 px, 4 au-delà. */
export function CoverGrid({ cards }: { cards: VCard[] }) {
  const { t } = useI18n();
  if (!cards.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((c) => (
        <li key={c.editionId}>
          <SiteLink page="livre" params={{ slug: c.slug }} className="group block">
            <div className="border-line bg-paper aspect-[148/210] w-full overflow-hidden border">
              {c.coverUrl && <img src={c.coverUrl} alt={c.title} loading="lazy" className="h-full w-full object-cover" />}
            </div>
            {c.tome != null && <p className="label text-secondary-text mt-3">{t("vitrine.tome").replace("{n}", String(c.tome))}</p>}
            <p className="mt-1 leading-snug group-hover:underline">{c.title}</p>
          </SiteLink>
        </li>
      ))}
    </ul>
  );
}
