import { useState } from "react";
import { useI18n } from "@/i18n/context";
import {
  blockSupport,
  leftHebrew,
  parseSupport,
  type BookPage,
  type GlossaryWord,
} from "@/lib/book-page";
import { BookSpread } from "./BookSpread";
import { GlossaryPage } from "./GlossaryPage";

/**
 * Les pages du livre sur le site : d'abord la double page telle qu'elle est
 * imprimée, ensuite — et seulement si le lecteur le demande — la même page en
 * grand, dans l'ordre du livre. Aucune mécanique qui n'existe pas sur papier.
 */

/** La même page, à la taille du téléphone. Rien n'est ajouté : c'est le texte. */
function PageReader({ page, color }: { page: BookPage; color: string | null }) {
  const { t, lang } = useI18n();
  const blocks = [...page.blocks].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      {page.keys.length > 0 && page.support_kind === "keys" ? (
        <p className="body-text text-secondary-text">{t("pages.keysInstruction")}</p>
      ) : null}
      {blocks.map((b) => {
        const he = leftHebrew(b, page.support_kind);
        const support =
          page.support_kind === "nikud" ? b.he_nikud : blockSupport(b, lang);
        return (
          <div key={b.id} className="border-line mt-8 border-t pt-5 first:mt-0 first:border-0 first:pt-0">
            {he ? (
              <p
                dir="rtl"
                lang="he"
                className="text-right"
                style={{
                  fontFamily: "var(--font-hebrew)",
                  fontSize: "calc(26px * var(--text-scale))",
                  lineHeight: 1.9,
                }}
              >
                {he}
              </p>
            ) : null}
            {support ? (
              page.support_kind === "nikud" ? (
                <p
                  dir="rtl"
                  lang="he"
                  className="text-secondary-text mt-3 text-right"
                  style={{
                    fontFamily: "var(--font-hebrew)",
                    fontSize: "calc(21px * var(--text-scale))",
                    lineHeight: 1.9,
                  }}
                >
                  {support}
                </p>
              ) : (
                <p className="body-text text-secondary-text mt-3">
                  {parseSupport(support).map((piece, i) =>
                    "gloss_no" in piece ? (
                      <em key={i} className="whitespace-nowrap italic">
                        {piece.translit} ({piece.gloss_no})
                      </em>
                    ) : (
                      <span key={i}>{piece.text}</span>
                    ),
                  )}
                </p>
              )
            ) : null}
          </div>
        );
      })}

      {page.keys.length > 0 ? (
        <dl className="mt-8">
          {page.keys.map((k) => (
            <div key={k.id} className="border-line mt-3 border-t pt-3">
              <dt className="flex items-baseline gap-3">
                <span className="label" style={{ color: color ?? undefined }}>
                  {k.gloss_no ?? ""}
                </span>
                <span
                  dir="rtl"
                  lang="he"
                  style={{ fontFamily: "var(--font-hebrew)", fontSize: "calc(21px * var(--text-scale))" }}
                >
                  {k.he_nikud}
                </span>
                {k.translit ? <span className="body-text italic">{k.translit}</span> : null}
              </dt>
              <dd className="body-text text-secondary-text mt-1">
                {(lang === "en" ? k.sense_en : k.sense_fr) ?? ""}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function BookPagesSection({
  pages,
  words = [],
  color = null,
  bookTitle,
  claim,
  note,
  showGlossary = false,
}: {
  pages: BookPage[];
  words?: GlossaryWord[];
  color?: string | null;
  bookTitle: string;
  /** null pour ne rien afficher ; undefined pour la phrase par défaut. */
  claim?: string | null;
  note?: string | null;
  showGlossary?: boolean;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [grid, setGrid] = useState(false);
  const [reading, setReading] = useState(false);
  const [zoom, setZoom] = useState(1);


  if (pages.length === 0) return null;
  const page = pages[Math.min(index, pages.length - 1)]!;

  const claimText = claim === undefined ? t("spread.claim") : claim;
  const noteText = note === undefined ? t("spread.note") : note;

  return (
    <section className="mt-8">
      {claimText ? (
        <p style={{ fontSize: "calc(19px * var(--text-scale))", lineHeight: 1.55 }}>{claimText}</p>
      ) : null}

      {pages.length > 1 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setIndex(i);
                setReading(false);
              }}
              className="label touch border-line border px-3"
              style={
                i === index
                  ? { background: "var(--color-foreground)", color: "var(--color-background)" }
                  : undefined
              }
              aria-current={i === index}
            >
              {t(`pages.kind.${p.support_kind}`)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <div style={{ width: `${zoom * 100}%` }}>
          <BookSpread page={page} color={color} bookTitle={bookTitle} showGrid={grid} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <p className="label text-secondary-text">
          {t("pages.chapter")} {page.chapter_no ?? "—"} · {t("pages.page")} {page.page_no}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.5) * 2) / 2))}
            disabled={zoom <= 1}
            aria-label="Réduire"
            className="label touch border-line border px-3 disabled:opacity-40"
          >
            −
          </button>
          <span className="label text-secondary-text w-12 text-center">
            {Math.round(zoom * 100)} %
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.5) * 2) / 2))}
            disabled={zoom >= 4}
            aria-label="Agrandir"
            className="label touch border-line border px-3 disabled:opacity-40"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={() => setGrid((v) => !v)}
          className="label touch border-b border-current"
        >
          {grid ? t("pages.gridOff") : t("pages.grid")}
        </button>
      </div>


      {noteText ? <p className="label text-secondary-text mt-4">{noteText}</p> : null}

      {reading ? (
        <div className="border-line mt-8 border-t pt-8">
          <PageReader page={page} color={color} />
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

      {showGlossary && words.length > 0 ? (
        <div className="border-line mt-12 border-t pt-8">
          <h3 className="text-[22px]">{t("gloss.title")}</h3>
          <div className="mt-6 overflow-x-auto">
            <GlossaryPage words={words} color={color} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
