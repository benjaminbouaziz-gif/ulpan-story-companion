import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { pickLang, useI18n } from "@/i18n/context";
import {
  MM,
  blockSupport,
  leftHebrew,
  parseSupport,
  pageKeySense,
  supportOffsetMm,
  usesSharedGrid,
  type BookPage,
  type PageBlock,
  type PageKey,
} from "@/lib/book-page";

/**
 * Une double page du livre, au millimètre : A5 × 2, marges réelles,
 * typographies réelles. Aux étapes translation, cloze et nikud, les deux pages
 * partagent une grille et chaque bande prend la hauteur du plus haut des deux
 * côtés : l'alignement est une propriété de la structure. À l'étape keys, la
 * page de droite est un tableau de plus de cent millimètres : les deux colonnes
 * y sont indépendantes, sinon le texte hébreu sort de la page.
 */

const SPREAD_MM = MM.pageW * 2;
const CONTENT_MM = MM.pageW - MM.marginSide * 2;

function useScale(maxPxPerMm: number) {
  const holder = useRef<HTMLDivElement>(null);
  const [ppm, setPpm] = useState(maxPxPerMm);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setPpm(Math.min(maxPxPerMm, el.clientWidth / SPREAD_MM));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxPxPerMm]);
  return { holder, ppm };
}

type MMFn = (v: number) => string;

function HebrewBlock({ text, mm }: { text: string; mm: MMFn }) {
  return (
    <p
      dir="rtl"
      lang="he"
      className="text-right"
      style={{
        fontFamily: "var(--font-hebrew)",
        fontSize: mm(MM.hebrewSize),
        lineHeight: MM.hebrewLine,
        letterSpacing: "normal",
        textTransform: "none",
        fontStretch: "normal",
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

/** Le mot en phonétique et son numéro : un seul objet, jamais coupé. */
function SupportBlock({
  block,
  page,
  mm,
}: {
  block: PageBlock;
  page: BookPage;
  mm: MMFn;
}) {
  const { lang } = useI18n();

  if (page.support_kind === "nikud") {
    const text = block.he_nikud;
    if (!text) return null;
    return (
      <p
        dir="rtl"
        lang="he"
        className="text-right"
        style={{
          fontFamily: "var(--font-hebrew)",
          fontSize: mm(MM.supportHeSize),
          lineHeight: MM.supportHeLine,
          letterSpacing: "normal",
          textTransform: "none",
          margin: 0,
        }}
      >
        {text}
      </p>
    );
  }

  const text = blockSupport(block, lang);
  if (!text) return null;

  return (
    <p
      style={{
        fontFamily: "var(--font-latin)",
        fontSize: mm(MM.supportSize),
        lineHeight: MM.supportLine,
        margin: 0,
      }}
    >
      {parseSupport(text).map((piece, i) =>
        "gloss_no" in piece ? (
          <em key={i} style={{ fontStyle: "italic", whiteSpace: "nowrap" }}>
            {piece.translit} ({piece.gloss_no})
          </em>
        ) : (
          <span key={i}>{piece.text}</span>
        ),
      )}
    </p>
  );
}

function KeysTable({
  keys,
  mm,
  color,
}: {
  keys: PageKey[];
  mm: MMFn;
  color: string | null;
}) {
  const { lang } = useI18n();
  return (
    <div>
      {keys.map((k) => (
        <div
          key={k.id}
          className="border-b"
          style={{
            display: "grid",
            gridTemplateColumns: `${mm(MM.keyNoW)} ${mm(MM.keyHeW)} ${mm(MM.keyTranslitW)} minmax(0,1fr)`,
            alignItems: "baseline",
            columnGap: mm(1.2),
            paddingBottom: mm(1),
            paddingTop: mm(1),
            borderColor: "rgba(21,23,26,.14)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: mm(MM.keyNoSize),
              color: color ?? "#6C6C66",
            }}
          >
            {k.gloss_no ?? ""}
          </span>
          <span
            dir="rtl"
            lang="he"
            style={{
              unicodeBidi: "isolate",
              textAlign: "right",
              fontFamily: "var(--font-hebrew)",
              fontSize: mm(MM.keyHeSize),
              letterSpacing: "normal",
            }}
          >
            {k.he_nikud}
          </span>
          <span
            style={{
              fontFamily: "var(--font-latin)",
              fontSize: mm(MM.keyTranslitSize),
              fontStyle: "italic",
            }}
          >
            {k.translit ?? ""}
          </span>
          <span style={{ fontFamily: "var(--font-latin)", fontSize: mm(MM.keySenseSize) }}>
            {pageKeySense(k, lang) ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BookSpread({
  page,
  color = null,
  bookTitle,
  showGrid = false,
  maxPxPerMm = 3.78,
}: {
  page: BookPage;
  color?: string | null;
  bookTitle: string;
  showGrid?: boolean;
  maxPxPerMm?: number;
}) {
  const { t, lang } = useI18n();
  const { holder, ppm } = useScale(maxPxPerMm);
  const gridRef = useRef<HTMLDivElement>(null);
  const [bandTops, setBandTops] = useState<number[]>([]);

  const mm: MMFn = (v) => `${v * ppm}px`;
  const shared = usesSharedGrid(page.support_kind);
  const blocks = [...page.blocks].sort((a, b) => a.sort_order - b.sort_order);
  const gridTop = MM.marginTop + MM.runheadSize * 1.2 + MM.runheadGap;

  // La trame : le haut de chaque bande, relevé sur le rendu réel. Les traits
  // doivent former des lignes continues d'une page à l'autre.
  useLayoutEffect(() => {
    if (!showGrid || !shared) {
      setBandTops([]);
      return;
    }
    const measure = () => {
      const el = gridRef.current;
      if (!el) return;
      const base = el.getBoundingClientRect().top;
      const tops = Array.from(el.querySelectorAll<HTMLElement>("[data-band-left]")).map(
        (cell) => cell.getBoundingClientRect().top - base,
      );
      setBandTops(tops);
    };
    measure();
    const id = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(id);
  }, [showGrid, shared, ppm, page.id, lang, blocks.length]);

  const runHead = pickLang(lang, page.running_head_fr, page.running_head_en) ?? bookTitle;
  const rightHead = [
    page.chapter_no ? `${t("pages.chapter")} ${page.chapter_no}` : null,
    `${t("pages.page")} ${page.page_no}`,
    t(`pages.kind.${page.support_kind}`),
  ]
    .filter(Boolean)
    .join(" · ");

  // Les étapes « trous » et « vocalisation » ne reprennent pas le titre du chapitre.
  const showChapterTitles = page.support_kind !== "cloze" && page.support_kind !== "nikud";
  const chapterTitleLatin = showChapterTitles
    ? pickLang(lang, page.chapter_title_fr, page.chapter_title_en)
    : null;
  const chapterTitleHe = showChapterTitles ? page.chapter_title_he : null;
  const folio = page.folio ?? page.page_no;

  const headStyle = {
    fontFamily: "var(--font-ui)",
    fontSize: mm(MM.runheadSize),
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: "#6C6C66",
    margin: 0,
  };

  const sharedRows = (
    <div
      ref={gridRef}
      style={{
        position: "absolute",
        top: mm(gridTop),
        left: mm(MM.marginSide),
        width: mm(SPREAD_MM - MM.marginSide * 2),
        display: "grid",
        gridTemplateColumns: `${mm(CONTENT_MM)} ${mm(MM.marginSide * 2)} ${mm(CONTENT_MM)}`,
      }}
    >
      {chapterTitleLatin || page.chapter_title_he ? (
        <>
          <div data-band-left style={{ paddingBottom: mm(MM.chapterGap) }}>
            {page.chapter_title_he ? (
              <p
                dir="rtl"
                lang="he"
                className="text-right"
                style={{
                  fontFamily: "var(--font-hebrew)",
                  fontSize: mm(MM.chapterHebrew),
                  letterSpacing: "normal",
                  margin: 0,
                }}
              >
                {page.chapter_title_he}
              </p>
            ) : null}
          </div>
          <div />
          <div style={{ paddingBottom: mm(MM.chapterGap) }}>
            {chapterTitleLatin ? (
              <p
                style={{
                  fontFamily: "var(--font-latin)",
                  fontSize: mm(MM.chapterLatin),
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                {chapterTitleLatin}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {blocks.map((b, i) => {
        const he = leftHebrew(b, page.support_kind);
        const gap = i === 0 ? 0 : MM.blockGap;
        return (
          <div key={b.id} style={{ display: "contents" }}>
            <div data-band-left style={{ paddingTop: mm(gap) }}>
              {he ? <HebrewBlock text={he} mm={mm} /> : null}
            </div>
            <div />
            <div style={{ paddingTop: mm(gap + supportOffsetMm(page.support_kind)) }}>
              <SupportBlock block={b} page={page} mm={mm} />
            </div>
          </div>
        );
      })}

      {/* Étape 4 : le bloc « מילים חדשות » a sa bande à lui, cellule gauche vide. */}
      {page.support_kind === "nikud" && page.keys.length > 0 ? (
        <>
          <div data-band-left style={{ paddingTop: mm(MM.blockGap * 3) }} />
          <div />
          <div style={{ paddingTop: mm(MM.blockGap * 3) }}>
            <p
              dir="rtl"
              lang="he"
              className="text-right"
              style={{
                fontFamily: "var(--font-hebrew)",
                fontSize: mm(MM.supportHeSize),
                letterSpacing: "normal",
                margin: 0,
                marginBottom: mm(1.5),
                color: color ?? "#6C6C66",
              }}
            >
              מִילִּים חֲדָשׁוֹת
            </p>
            <KeysTable keys={page.keys} mm={mm} color={color} />
          </div>
        </>
      ) : null}
    </div>
  );

  const independentColumns = (
    <>
      <div
        style={{
          position: "absolute",
          top: mm(gridTop),
          left: mm(MM.marginSide),
          width: mm(CONTENT_MM),
        }}
      >
        {blocks.map((b, i) => {
          const he = leftHebrew(b, page.support_kind);
          if (!he) return null;
          return (
            <div key={b.id} style={{ paddingTop: mm(i === 0 ? 0 : MM.blockGap) }}>
              <HebrewBlock text={he} mm={mm} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: mm(gridTop),
          left: mm(MM.pageW + MM.marginSide),
          width: mm(CONTENT_MM),
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-latin)",
            fontSize: mm(MM.supportSize),
            lineHeight: MM.supportLine,
            margin: 0,
            marginBottom: mm(2),
          }}
        >
          {t("pages.keysInstruction")}
        </p>
        <KeysTable keys={page.keys} mm={mm} color={color} />
      </div>
    </>
  );

  return (
    <div ref={holder} className="w-full">
      <div
        className="relative"
        style={{
          width: mm(SPREAD_MM),
          height: mm(MM.pageH),
          background: "#F3F1EA",
          color: "#15171A",
          boxShadow: "0 18px 36px -26px rgba(0,0,0,.5)",
          overflow: "hidden",
        }}
      >
        {/* Titres courants */}
        <p
          className="text-right"
          style={{
            ...headStyle,
            position: "absolute",
            top: mm(MM.marginTop),
            left: mm(MM.marginSide),
            width: mm(CONTENT_MM),
          }}
        >
          {runHead}
        </p>
        <p
          style={{
            ...headStyle,
            position: "absolute",
            top: mm(MM.marginTop),
            left: mm(MM.pageW + MM.marginSide),
            width: mm(CONTENT_MM),
          }}
        >
          {rightHead}
        </p>

        {shared ? sharedRows : independentColumns}

        {/* Filet de pliure */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: mm(MM.pageW),
            width: Math.max(1, MM.fold * ppm),
            height: "100%",
            background: "rgba(21,23,26,.10)",
          }}
        />

        {/* Folios, à l'extérieur */}
        <span
          style={{
            position: "absolute",
            bottom: mm(MM.folioBottom),
            left: mm(MM.marginSide),
            fontFamily: "var(--font-latin)",
            fontSize: mm(MM.folioSize),
            color: "#6C6C66",
          }}
        >
          {folio}
        </span>
        <span
          style={{
            position: "absolute",
            bottom: mm(MM.folioBottom),
            right: mm(MM.marginSide),
            fontFamily: "var(--font-latin)",
            fontSize: mm(MM.folioSize),
            color: "#6C6C66",
          }}
        >
          {folio + 1}
        </span>

        {showGrid
          ? bandTops.map((top, i) => (
              <div
                key={i}
                className="pointer-events-none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: top + gridTop * ppm,
                  height: 1,
                  background: "rgba(22,64,122,.45)",
                }}
              />
            ))
          : null}
      </div>
    </div>
  );
}
