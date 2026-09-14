import { useState } from "react";
import { useI18n } from "@/i18n/context";
import {
  blockSupport,
  leftHebrew,
  parseSupport,
  type BookPage,
  type GlossaryWord,
} from "@/lib/book-page";
import { GlossaryPage } from "./GlossaryPage";

/**
 * Les pages du livre sur le site : le texte hébreu et son soutien forment une
 * suite de couples lisibles, sans reproduire les dimensions de l'imprimé.
 */

/** La page adaptée à l'écran, sans titre courant, chapitre ni folio. */
function PageReader({ page, color }: { page: BookPage; color: string | null }) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const blocks = [...page.blocks].sort((a, b) => a.sort_order - b.sort_order);
  const visibleBlocks = expanded ? blocks : blocks.slice(0, 4);

  return (
    <div>
      {page.keys.length > 0 && page.support_kind === "keys" ? (
        <p className="body-text text-secondary-text">{t("pages.keysInstruction")}</p>
      ) : null}
      {visibleBlocks.map((b, index) => {
        const he = leftHebrew(b, page.support_kind);
        const support = page.support_kind === "nikud" ? b.he_nikud : blockSupport(b, lang);
        return (
          <div key={b.id} className={index === 0 ? "" : "mt-[1.6em]"}>
            {he ? (
              <p
                dir="rtl"
                lang="he"
                className="text-right"
                style={{
                  fontFamily: "var(--font-hebrew)",
                  fontSize: "calc(21px * var(--text-scale))",
                  lineHeight: 1.95,
                  letterSpacing: "normal",
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
                  className="text-secondary-text mt-[0.4em] text-right"
                  style={{
                    fontFamily: "var(--font-hebrew)",
                    fontSize: "calc(15px * var(--text-scale))",
                    lineHeight: 1.6,
                    letterSpacing: "normal",
                  }}
                >
                  {support}
                </p>
              ) : (
                <p
                  className="text-secondary-text mt-[0.4em]"
                  style={{ fontSize: "calc(15px * var(--text-scale))", lineHeight: 1.6 }}
                >
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

      {blocks.length > 4 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="label touch mt-8 border-b border-current"
          aria-expanded={expanded}
        >
          {expanded ? t("excerpt.collapse") : t("excerpt.readMore")}
        </button>
      ) : null}

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
                  style={{
                    fontFamily: "var(--font-hebrew)",
                    fontSize: "calc(21px * var(--text-scale))",
                  }}
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

  if (pages.length === 0) return null;
  const page = pages[Math.min(index, pages.length - 1)];
  if (!page) return null;

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
              onClick={() => setIndex(i)}
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

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <p className="label text-secondary-text">
          {t("pages.chapter")} {page.chapter_no ?? "—"} · {t("pages.page")} {page.page_no}
        </p>
      </div>

      <div className="mt-6">
        <PageReader page={page} color={color} />
      </div>

      {noteText ? <p className="label text-secondary-text mt-4">{noteText}</p> : null}

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
