import type { ReactNode } from "react";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { Bandeau } from "@/components/Bandeau";
import { HebrewText } from "@/components/HebrewText";
import { SiteLink } from "@/components/SiteLink";
import type { BlocksPageData, BookData, CollectionData, HomeData, VCollCard } from "@/lib/vitrine.data";
import { Blocks, Paragraphs } from "./Blocks";
import { CoverGrid } from "./CoverGrid";
import { MethodTabs } from "./MethodTabs";
import { ZoomImage } from "./ZoomImage";

/** Pages de la vitrine : mêmes composants pour le site public et les aperçus de l'admin. */

const READ = "mx-auto w-full max-w-[65ch] px-4";
const WIDE = "mx-auto w-full max-w-[1100px] px-4";
const linkBtn = "label border-line inline-flex items-center border px-4 py-2 text-foreground hover:bg-ivory-2";

const tn = (s: string, n: number) => s.replace("{n}", String(n));

function Section({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <section className={`${wide ? WIDE : READ} py-10`}>{children}</section>;
}

function CollectionCards({ items }: { items: VCollCard[] }) {
  if (!items.length) return null;
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <li key={c.slug} className={`border-line border ${c.hidden ? "opacity-70" : ""}`}>
          <SiteLink page="collection" params={{ slug: c.slug }} className="block">
            <div className="p-5">
              <h3 className="text-[22px]">{c.name}</h3>
              {c.tagline && <p className="text-secondary-text mt-2">{c.tagline}</p>}
            </div>
            <Bandeau color={c.color} />
          </SiteLink>
        </li>
      ))}
    </ul>
  );
}

export function HomePage({ d }: { d: HomeData }) {
  const { t } = useI18n();
  const hasMethod = d.methode.length > 0 || d.steps.some((s) => s.imageUrl);
  return (
    <main>
      {d.ouverture.length > 0 && (
        <Section><Blocks blocks={d.ouverture} firstTitleH1 /></Section>
      )}
      {hasMethod && (
        <Section>
          <Blocks blocks={d.methode} />
          <div className="mt-6"><MethodTabs steps={d.steps} /></div>
          <div className="mt-6"><SiteLink page="methode" className={linkBtn}>{t("vitrine.discoverMethod")}</SiteLink></div>
        </Section>
      )}
      {(d.livres.length > 0 || d.editions.length > 0) && (
        <section className={`${WIDE} py-10`}>
          <div className="max-w-[65ch]"><Blocks blocks={d.livres} /></div>
          <div className="mt-6"><CoverGrid cards={d.editions} /></div>
        </section>
      )}
      {(d.collectionsBlocks.length > 0 || d.collections.length > 0) && (
        <section className={`${WIDE} py-10`}>
          <div className="max-w-[65ch]"><Blocks blocks={d.collectionsBlocks} /></div>
          <div className="mt-6"><CollectionCards items={d.collections} /></div>
        </section>
      )}
      {d.lecteur.length > 0 && (
        <Section>
          <Blocks blocks={d.lecteur} />
          <div className="mt-6"><SiteLink page="espace_lecteur" className={linkBtn}>{t("nav.companion")}</SiteLink></div>
        </Section>
      )}
    </main>
  );
}

export function MethodPage({ d }: { d: BlocksPageData }) {
  const { t } = useI18n();
  return (
    <main className={`${READ} py-10`}>
      <h1 className="text-[34px]">{t("page.methode")}</h1>
      <div className="mt-6"><MethodTabs steps={d.steps} /></div>
      <div className="mt-8"><Blocks blocks={d.blocks} /></div>
    </main>
  );
}

export function SimplePage({ d, titleKey }: { d: BlocksPageData; titleKey: DictKey }) {
  const { t } = useI18n();
  return (
    <main className={`${READ} py-10`}>
      <h1 className="text-[34px]">{t(titleKey)}</h1>
      <div className="mt-6"><Blocks blocks={d.blocks} /></div>
    </main>
  );
}

export function CollectionsPage({ d }: { d: { collections: VCollCard[] } }) {
  const { t } = useI18n();
  return (
    <main className={`${WIDE} py-10`}>
      <h1 className="text-[34px]">{t("page.collections")}</h1>
      <div className="mt-8"><CollectionCards items={d.collections} /></div>
    </main>
  );
}

export function CollectionPage({ d }: { d: CollectionData }) {
  const { t } = useI18n();
  return (
    <main className="py-10">
      <div className={READ}>
        <h1 className="text-[34px]">{d.name}</h1>
        {d.tagline && <p className="text-secondary-text mt-2 text-[20px]">{d.tagline}</p>}
      </div>
      <div className={`${READ} mt-6`}><Bandeau color={d.color} /></div>
      <div className={`${READ} mt-8 space-y-8`}>
        {d.description && <Paragraphs text={d.description} />}
        <Blocks blocks={d.blocks} />
        {d.forWhom && (
          <div>
            <h2 className="text-[26px]">{t("vitrine.forWhom")}</h2>
            <Paragraphs text={d.forWhom} className="mt-3" />
          </div>
        )}
      </div>
      {d.tomes.length > 0 && <div className={`${WIDE} mt-12`}><CoverGrid cards={d.tomes} /></div>}
    </main>
  );
}

export function BookPage({ d, onAmazon }: { d: BookData; onAmazon?: () => void }) {
  const { t } = useI18n();
  const level = [
    d.chapters ? tn(t("vitrine.chapters"), d.chapters) : null,
    d.vocab ? tn(t("vitrine.vocab"), d.vocab) : null,
    d.pages ? tn(t("vitrine.pages"), d.pages) : null,
  ].filter(Boolean) as string[];
  return (
    <main className="py-6 lg:py-10">
      <div className={`${WIDE} grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12`}>
        <div className="mx-auto w-[42%] max-w-[420px] md:w-full">
          {d.coverUrl ? (
            <ZoomImage src={d.coverUrl} alt={d.title} className="border-line border" />
          ) : (
            <div className="border-line bg-paper aspect-[148/210] border" />
          )}
        </div>
        <div className="min-w-0">
          {d.collection?.name && (
            <SiteLink page="collection" params={{ slug: d.collection.slug }} className="label text-secondary-text hover:underline">{d.collection.name}</SiteLink>
          )}
          {d.tome != null && <p className="label text-secondary-text mt-2">{tn(t("vitrine.tome"), d.tome)}</p>}
          <h1 className="mt-1 text-[30px] md:text-[40px]">{d.title}</h1>
          {d.subtitle && <p className="text-secondary-text mt-1 text-[19px]">{d.subtitle}</p>}
          {d.titleHe && <HebrewText size="lg" className="mt-2">{d.titleHe}</HebrewText>}
          {d.collection && <div className="mt-3"><Bandeau color={d.collection.color} /></div>}
          {d.blurb && <Paragraphs text={d.blurb} className="mt-4" />}
          {d.amazonUrl && (
            <a
              href={d.amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onAmazon}
              className="bg-foreground text-background mt-5 inline-flex items-center px-6 py-3 text-[17px] font-medium hover:opacity-90"
            >
              {t("vitrine.buyAmazon")}
            </a>
          )}
        </div>
      </div>

      {d.excerptUrl && (
        <section className={`${READ} mt-14`}>
          <h2 className="text-[26px]">{t("vitrine.sample")}</h2>
          <div className="mt-4"><ZoomImage src={d.excerptUrl} alt={`${t("vitrine.sample")} — ${d.title}`} className="border-line border" /></div>
        </section>
      )}
      {d.learnItems.length > 0 && (
        <section className={`${READ} mt-12`}>
          <h2 className="text-[26px]">{t("vitrine.learn")}</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            {d.learnItems.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </section>
      )}
      {(level.length > 0 || d.levelNote) && (
        <section className={`${READ} mt-12`}>
          <h2 className="text-[26px]">{t("vitrine.level")}</h2>
          {level.length > 0 && <p className="mt-3">{level.join(" · ")}</p>}
          {d.levelNote && <Paragraphs text={d.levelNote} className="text-secondary-text mt-3" />}
        </section>
      )}
      {d.sameCollection.length > 0 && (
        <section className={`${WIDE} mt-14`}>
          <h2 className="text-[26px]">{t("vitrine.sameCollection")}</h2>
          <div className="mt-6"><CoverGrid cards={d.sameCollection} /></div>
        </section>
      )}
    </main>
  );
}
