import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { Bandeau } from "@/components/Bandeau";
import { HebrewText } from "@/components/HebrewText";
import { SiteLink } from "@/components/SiteLink";
import { BookOpen, Headphones, ListChecks } from "lucide-react";
import type { BlocksPageData, BookData, CollectionData, HomeCard, HomeData, VBlock, VCollCard } from "@/lib/vitrine.data";
import { anchorOf, Blocks, Paragraphs } from "./Blocks";
import { CoverGrid } from "./CoverGrid";
import { MethodTabs } from "./MethodTabs";
import { ZoomImage } from "./ZoomImage";

/** Pages de la vitrine : mêmes composants pour le site public et les aperçus de l'admin. */

// Cadre commun (frame) ; les textes longs gardent la colonne de lecture (read), calée à gauche.
const READ = "frame [&>*]:read";
const WIDE = "frame";
const linkBtn = "label border-line inline-flex items-center border px-4 py-2 text-foreground hover:bg-ivory-2";

const tn = (s: string, n: number) => s.replace("{n}", String(n));

function Section({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <section className={`${wide ? WIDE : READ} py-10`}>{children}</section>;
}

function CollectionCards({ items }: { items: VCollCard[] }) {
  if (!items.length) return null;
  return (
    <ul className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr))]">
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

const btnFull = "bg-foreground text-background inline-flex min-h-12 items-center justify-center px-6 py-3 text-[17px] font-medium hover:opacity-90";
const btnLine = "border-foreground text-foreground inline-flex min-h-12 items-center justify-center border px-6 py-3 text-[17px] font-medium hover:bg-ivory-2";

/** Paragraphes de tous les blocs texte d'une zone. */
function paragraphsOf(blocks: VBlock[]) {
  return blocks.filter((b) => b.kind === "texte" && b.body).flatMap((b) => b.body!.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean));
}

function Featured({ c, onAmazon }: { c: HomeCard; onAmazon?: ((id: string) => void) | undefined }) {
  const { t } = useI18n();
  const kicker = [c.collectionName, c.tome != null ? tn(t("vitrine.tome"), c.tome) : null].filter(Boolean).join(" · ");
  return (
    <article className={`border-line bg-paper grid gap-6 border p-5 sm:p-8 md:grid-cols-12 md:gap-10 ${c.hidden ? "opacity-70" : ""}`}>
      <div className="mx-auto w-[60%] max-w-[300px] md:col-span-4 md:w-full">
        <div className="border-line bg-background aspect-[148/210] overflow-hidden border shadow-[0_12px_30px_-14px_color-mix(in_oklab,var(--on-surface)_45%,transparent)]">
          {c.coverUrl && <img src={c.coverUrl} alt={c.title} loading="lazy" className="h-full w-full object-cover" />}
        </div>
      </div>
      <div className="min-w-0 md:col-span-8 md:self-center">
        {kicker && <p className="label text-secondary-text">{kicker}</p>}
        <h3 className="mt-2 text-[28px] md:text-[34px]">{c.title}</h3>
        {c.blurb && <Paragraphs text={c.blurb} className="mt-4" />}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {c.amazonUrl && (
            <a href={c.amazonUrl} target="_blank" rel="noopener noreferrer" onClick={() => onAmazon?.(c.editionId)} data-amazon="home" className={btnFull}>
              {t("vitrine.buyAmazon")}
            </a>
          )}
          <SiteLink page="livre" params={{ slug: c.slug }} className={btnLine}>{t("vitrine.discoverBook")}</SiteLink>
        </div>
      </div>
    </article>
  );
}

const FEAT_ICONS = [Headphones, ListChecks, BookOpen];
const FEAT_KEYS: DictKey[] = ["vitrine.featAudio", "vitrine.featQuiz", "vitrine.featGlossary"];

export function HomePage({ d, onAmazon }: { d: HomeData; onAmazon?: (editionId: string) => void }) {
  const { t } = useI18n();
  const hasMethod = d.methode.length > 0 || d.steps.some((s) => s.imageUrl);
  const latest = d.editions[0];
  const step1 = d.steps.find((s) => s.imageUrl);
  const lecteurTitle = d.lecteur.find((b) => b.kind === "titre" && b.title)?.title;
  const paras = paragraphsOf(d.lecteur);
  const withCards = paras.length >= 5;
  return (
    <main className="flex flex-col gap-16 py-10 lg:gap-24 lg:py-16">
      {(d.ouverture.length > 0 || latest || step1) && (
        <section className="frame grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
          <div className="min-w-0 lg:col-span-7 [&>*]:read">
            <Blocks blocks={d.ouverture} firstTitleH1 h1ClassName="text-[clamp(34px,5vw,56px)]" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {latest && <SiteLink page="livre" params={{ slug: latest.slug }} className={btnFull}>{t("vitrine.seeBook")}</SiteLink>}
              <SiteLink page="methode" className={latest ? btnLine : btnFull}>{t("vitrine.theMethod")}</SiteLink>
            </div>
          </div>
          {(latest?.coverUrl || step1) && (
            <div className="mx-auto w-full max-w-[360px] lg:col-span-5 lg:max-w-none">
              {latest?.coverUrl ? (
                <div className="relative pb-[28%]">
                  <img src={latest.coverUrl} alt={latest.title} className="border-line relative w-[62%] border shadow-[0_18px_40px_-18px_color-mix(in_oklab,var(--on-surface)_50%,transparent)]" />
                  {step1 && (
                    <img src={step1.imageUrl!} alt={step1.label} loading="lazy" className="border-line absolute right-0 bottom-0 z-10 w-[64%] border shadow-[0_18px_40px_-18px_color-mix(in_oklab,var(--on-surface)_50%,transparent)]" />
                  )}
                </div>
              ) : (
                step1 && <img src={step1.imageUrl!} alt={step1.label} className="border-line w-full border" />
              )}
            </div>
          )}
        </section>
      )}
      {hasMethod && (
        <section className="frame">
          <div className="[&>*]:read"><Blocks blocks={d.methode} /></div>
          <div className="mt-6"><MethodTabs steps={d.steps} /></div>
          <p className="text-secondary-text mt-4 flex flex-wrap items-center gap-x-2 text-[15px]">
            <span>{t("vitrine.tapToZoom")}</span>
            <span aria-hidden>·</span>
            <SiteLink page="methode" className="text-foreground underline-offset-4 hover:underline">{t("vitrine.discoverMethod")} →</SiteLink>
          </p>
        </section>
      )}
      {(d.livres.length > 0 || d.editions.length > 0) && (
        <section className="frame">
          <div className="[&>*]:read"><Blocks blocks={d.livres} /></div>
          <div className="mt-8">
            {d.editions.length < 3 ? (
              <div className="space-y-8">{d.editions.map((c) => <Featured key={c.editionId} c={c} onAmazon={onAmazon} />)}</div>
            ) : (
              <CoverGrid cards={d.editions} />
            )}
          </div>
        </section>
      )}
      {(d.collectionsBlocks.length > 0 || d.collections.length > 0) && (
        <section className="frame">
          <div className="[&>*]:read"><Blocks blocks={d.collectionsBlocks} /></div>
          <div className="mt-8"><CollectionCards items={d.collections} /></div>
        </section>
      )}
      {d.lecteur.length > 0 && (
        <section className="frame">
          {withCards ? (
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="read min-w-0 lg:col-span-7">
                {lecteurTitle && <h2 className="text-[26px]">{lecteurTitle}</h2>}
                <div className="mt-6 space-y-4">
                  <p className="whitespace-pre-line">{paras[0]}</p>
                  <p className="whitespace-pre-line">{paras[paras.length - 1]}</p>
                </div>
                <div className="mt-8"><SiteLink page="espace_lecteur" className={btnFull}>{t("nav.companion")}</SiteLink></div>
              </div>
              <ul className="space-y-4 lg:col-span-5">
                {FEAT_KEYS.map((k, i) => {
                  const Icon = FEAT_ICONS[i]!;
                  return (
                    <li key={k} className="border-line bg-paper flex gap-4 border p-5">
                      <span className="border-line grid size-11 shrink-0 place-items-center border"><Icon aria-hidden className="size-5" /></span>
                      <div className="min-w-0">
                        <h3 className="text-[20px]">{t(k)}</h3>
                        <p className="text-secondary-text mt-1 whitespace-pre-line">{paras[i + 1]}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="[&>*]:read">
              <Blocks blocks={d.lecteur} />
              <div className="mt-8"><SiteLink page="espace_lecteur" className={btnFull}>{t("nav.companion")}</SiteLink></div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

/** Découpe les blocs en sections, chacune ouverte par un bloc Titre. */
function sectionsOf(blocks: VBlock[]) {
  const out: VBlock[][] = [];
  for (const b of blocks) {
    if (b.kind === "titre" && b.title) out.push([b]);
    else if (out.length) out[out.length - 1]!.push(b);
    else out.push([b]);
  }
  return out;
}

function PageToc({ titles }: { titles: VBlock[] }) {
  const { t } = useI18n();
  const [active, setActive] = useState<string | null>(titles[0] ? anchorOf(titles[0]) : null);
  useEffect(() => {
    const onScroll = () => {
      let cur: string | null = titles[0] ? anchorOf(titles[0]) : null;
      for (const b of titles) {
        const el = document.getElementById(anchorOf(b));
        if (el && el.getBoundingClientRect().top <= 120) cur = anchorOf(b);
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [titles]);
  return (
    <nav aria-label={t("vitrine.onThisPage")} className="sticky top-20">
      <p className="label text-secondary-text">{t("vitrine.onThisPage")}</p>
      <ul className="border-line mt-3 border-l">
        {titles.map((b) => {
          const id = anchorOf(b);
          return (
            <li key={b.id}>
              <a
                href={`#${id}`}
                aria-current={active === id ? "location" : undefined}
                className={`-ml-px block truncate border-l-2 py-1.5 pl-3 text-[15px] ${active === id ? "border-foreground text-foreground" : "text-secondary-text hover:text-foreground border-transparent"}`}
              >
                {b.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MethodPage({ d }: { d: BlocksPageData }) {
  const { t } = useI18n();
  const sections = sectionsOf(d.blocks);
  const titles = d.blocks.filter((b) => b.kind === "titre" && b.title);
  const hasTabs = d.steps.some((s) => s.imageUrl);
  return (
    <main className="frame py-10">
      <h1 className="text-[34px]">{t("page.methode")}</h1>
      {hasTabs && (
        <>
          <div className="mt-6"><MethodTabs steps={d.steps} /></div>
          <p className="text-secondary-text mt-4 text-[15px]">{t("vitrine.tapToZoom")}</p>
        </>
      )}
      <div className="mt-16 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-16">
        <div className="hidden lg:block">{titles.length > 0 && <PageToc titles={titles} />}</div>
        <div className="flex min-w-0 flex-col gap-16">
          {sections.map((sec) => (
            <div key={sec[0]!.id} className="[&>*]:read"><Blocks blocks={sec} /></div>
          ))}
        </div>
      </div>
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
  // Barre fixe mobile : visible seulement quand le bouton d'origine est hors écran.
  const amazonRef = useRef<HTMLAnchorElement>(null);
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    const el = amazonRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([en]) => setShowBar(!en!.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [d.amazonUrl]);
  // Marge en bas du document pour que la barre ne masque jamais le pied de page.
  useEffect(() => {
    if (!showBar || !d.amazonUrl || !window.matchMedia("(max-width: 767px)").matches) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "80px";
    return () => { document.body.style.paddingBottom = prev; };
  }, [showBar, d.amazonUrl]);
  const stats = ([
    [d.chapters, "vitrine.statChapter1", "vitrine.statChapterN"],
    [d.vocab, "vitrine.statVocab1", "vitrine.statVocabN"],
    [d.pages, "vitrine.statPage1", "vitrine.statPageN"],
  ] as [number | null, DictKey, DictKey][]).filter(([n]) => !!n && n > 0);
  const kicker = [d.collection?.name, d.tome != null ? tn(t("vitrine.tome"), d.tome) : null].filter(Boolean).join(" · ");
  const accent = d.collection ? { color: d.collection.color } : undefined;
  return (
    <main className="py-6 lg:py-10">
      <div className="frame grid gap-8 lg:grid-cols-12 lg:gap-16">
        <div className="mx-auto w-full max-w-[300px] lg:col-span-5 lg:max-w-[440px]">
          <div className="lg:sticky lg:top-20">
            {d.coverUrl ? (
              <ZoomImage src={d.coverUrl} alt={d.title} className="border-line border" />
            ) : (
              <div className="border-line bg-paper aspect-[148/210] border" />
            )}
          </div>
        </div>
        <div className="min-w-0 lg:col-span-7">
          {kicker && (d.collection ? (
            <SiteLink page="collection" params={{ slug: d.collection.slug }} className="label hover:underline"><span style={accent}>{kicker}</span></SiteLink>
          ) : <p className="label">{kicker}</p>)}
          <h1 className="mt-2 text-[30px] md:text-[40px]">{d.title}</h1>
          {d.subtitle && <p className="text-secondary-text mt-1 text-[19px]">{d.subtitle}</p>}
          {d.amazonUrl && (
            <a
              ref={amazonRef}
              href={d.amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onAmazon}
              data-amazon="main"
              className="bg-foreground text-background mt-5 inline-flex min-h-12 items-center px-6 py-3 text-[17px] font-medium hover:opacity-90"
            >
              {t("vitrine.buyAmazon")}
            </a>
          )}
          {stats.length > 0 && (
            <dl className="border-line mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y py-5">
              {stats.map(([n, one, many]) => (
                <div key={one}>
                  <dt className="text-[32px] leading-none">{n}</dt>
                  <dd className="label text-secondary-text mt-2">{t(n === 1 ? one : many)}</dd>
                </div>
              ))}
            </dl>
          )}
          {d.blurb && <Paragraphs text={d.blurb} className="read mt-8" />}
          {d.learnItems.length > 0 && (
            <section className="read mt-12">
              <h2 className="text-[26px]">{t("vitrine.learn")}</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                {d.learnItems.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            </section>
          )}
          {d.levelNote && (
            <section className="read mt-12">
              <h2 className="text-[26px]">{t("vitrine.level")}</h2>
              <Paragraphs text={d.levelNote} className="text-secondary-text mt-3" />
            </section>
          )}
        </div>
      </div>

      {d.excerptUrl && (
        <section className="frame mt-16 lg:mt-24">
          <h2 className="text-[26px]">{t("vitrine.sample")}</h2>
          <div className="mt-4"><ZoomImage src={d.excerptUrl} alt={`${t("vitrine.sample")} — ${d.title}`} className="border-line border" /></div>
          <p className="text-secondary-text mt-3 text-[15px]">{t("vitrine.tapExcerpt")}</p>
        </section>
      )}
      {d.collection && d.sameCollection.length > 1 && (
        <section className="frame mt-16 lg:mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 className="text-[26px]">{t("vitrine.sameCollection")}</h2>
            <SiteLink page="collection" params={{ slug: d.collection.slug }} className="hover:underline">{t("vitrine.seeCollection")} →</SiteLink>
          </div>
          <div className="mt-6"><CoverGrid cards={d.sameCollection} currentId={d.editionId} cols4 /></div>
        </section>
      )}
      {d.amazonUrl && showBar && (
        <>
          <div className="bg-background border-line fixed inset-x-0 bottom-0 z-40 border-t p-3 md:hidden">
            <a
              href={d.amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onAmazon}
              data-amazon="bar"
              className="bg-foreground text-background flex w-full items-center justify-center px-6 py-3 text-[17px] font-medium"
            >
              {t("vitrine.buyAmazon")}
            </a>
          </div>
        </>
      )}
    </main>
  );
}
