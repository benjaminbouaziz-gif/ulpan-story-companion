import type { ReactNode } from "react";
import { pickLang, useI18n } from "@/i18n/context";
import type { Book, PageSection, SpreadBundle } from "@/lib/catalog.functions";
import { SpreadSection } from "./SpreadSection";

/**
 * Le rendu des sections d'une page éditoriale. Aucune phrase n'est écrite ici :
 * tout vient de page_sections, et se modifie depuis l'administration.
 */

type Json = Record<string, unknown>;

function data(section: PageSection): Json {
  return (section.data ?? {}) as Json;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/** {{book.chapters_count}}, {{book.words_unique}}, {{book.spread_pages}} */
export function resolveTokens(value: string, book: Book | null | undefined): string {
  return value.replace(/\{\{\s*book\.([a-z_]+)\s*\}\}/gi, (_m, field: string) => {
    if (!book) return "—";
    if (field === "spread_pages")
      return book.page_count ? String(Math.ceil(book.page_count / 2)) : "—";
    const raw = (book as unknown as Record<string, unknown>)[field];
    return raw === null || raw === undefined ? "—" : String(raw);
  });
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className="body-text mt-4 first:mt-0">
            {p}
          </p>
        ))}
    </>
  );
}

function Block({ children }: { children: ReactNode }) {
  return <section className="mt-14 first:mt-0">{children}</section>;
}

export function PageSections({
  sections,
  books,
  spreads,
}: {
  sections: PageSection[];
  books: Record<string, Book>;
  spreads: Record<string, SpreadBundle>;
}) {
  const { t, lang } = useI18n();
  if (sections.length === 0) return <p className="body-text">{t("empty.page")}</p>;

  return (
    <div>
      {sections.map((s) => {
        const d = data(s);
        const bookId = str(d["book_id"]);
        const book = bookId ? books[bookId] : undefined;
        const title = pickLang(lang, s.title_fr, s.title_en);
        const body = pickLang(lang, s.body_fr, s.body_en);

        if (s.kind === "book_spread") {
          const bundle = bookId ? spreads[bookId] : undefined;
          if (!bundle) return null;
          const b = bundle.book;
          return (
            <Block key={s.id}>
              {title ? (
                <p style={{ fontSize: "calc(19px * var(--text-scale))", lineHeight: 1.55 }}>
                  {resolveTokens(title, b)}
                </p>
              ) : null}
              <SpreadSection
                paragraphs={bundle.paragraphs}
                color={bundle.collection?.color_hex ?? null}
                runningHead={
                  pickLang(lang, b.spread_running_head_fr, b.spread_running_head_en) ??
                  pickLang(lang, b.title_fr, b.title_en) ??
                  ""
                }
                chapter={pickLang(lang, b.spread_chapter_fr, b.spread_chapter_en) ?? ""}
                folio={b.spread_folio_left ?? 42}
                claim={null}
                note={body}
              />
            </Block>
          );
        }

        if (s.kind === "facts") {
          const facts = Array.isArray(d["facts"]) ? (d["facts"] as Json[]) : [];
          return (
            <Block key={s.id}>
              {title ? <h2 className="text-[24px]">{resolveTokens(title, book)}</h2> : null}
              <dl className="border-line mt-6 border-t">
                {facts.map((f, i) => (
                  <div
                    key={i}
                    className="border-line flex items-baseline gap-4 border-b py-3"
                  >
                    <dt
                      className="shrink-0 tabular-nums"
                      style={{ fontSize: "calc(26px * var(--text-scale))", lineHeight: 1.2 }}
                    >
                      {resolveTokens(str(f["value"]) ?? "", book)}
                    </dt>
                    <dd className="body-text text-secondary-text">
                      {pickLang(lang, str(f["label_fr"]), str(f["label_en"])) ?? ""}
                    </dd>
                  </div>
                ))}
              </dl>
              {body ? (
                <div className="mt-6">
                  <Paragraphs text={resolveTokens(body, book)} />
                </div>
              ) : null}
            </Block>
          );
        }

        if (s.kind === "steps") {
          const steps = Array.isArray(d["steps"]) ? (d["steps"] as Json[]) : [];
          return (
            <Block key={s.id}>
              {title ? <h2 className="text-[24px]">{resolveTokens(title, book)}</h2> : null}
              <ol className="mt-6">
                {steps.map((st, i) => (
                  <li key={i} className="border-line mt-6 border-t pt-4 first:mt-0">
                    <p className="label text-secondary-text">
                      {pickLang(lang, str(st["label_fr"]), str(st["label_en"])) ??
                        String(st["n"] ?? i + 1)}
                    </p>
                    <div className="mt-2">
                      <Paragraphs
                        text={
                          pickLang(lang, str(st["body_fr"]), str(st["body_en"])) ?? ""
                        }
                      />
                    </div>
                  </li>
                ))}
              </ol>
              {body ? (
                <div className="mt-6">
                  <Paragraphs text={resolveTokens(body, book)} />
                </div>
              ) : null}
            </Block>
          );
        }

        if (s.kind === "faq") {
          const items = Array.isArray(d["items"]) ? (d["items"] as Json[]) : [];
          return (
            <Block key={s.id}>
              {title ? <h2 className="text-[24px]">{resolveTokens(title, book)}</h2> : null}
              <dl className="mt-6">
                {items.map((it, i) => (
                  <div key={i} className="border-line mt-6 border-t pt-4 first:mt-0">
                    <dt className="body-text">
                      {pickLang(lang, str(it["q_fr"]), str(it["q_en"])) ?? ""}
                    </dt>
                    <dd className="body-text text-secondary-text mt-2">
                      {pickLang(lang, str(it["a_fr"]), str(it["a_en"])) ?? ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </Block>
          );
        }

        if (s.kind === "quote") {
          return (
            <Block key={s.id}>
              <blockquote
                className="border-line border-l-2 pl-4"
                style={{ fontSize: "calc(21px * var(--text-scale))", lineHeight: 1.5 }}
              >
                {body ? resolveTokens(body, book) : resolveTokens(title ?? "", book)}
              </blockquote>
            </Block>
          );
        }

        if (s.kind === "heading") {
          return (
            <Block key={s.id}>
              <h2 className="text-[24px]">{resolveTokens(title ?? "", book)}</h2>
            </Block>
          );
        }

        // richtext et tout le reste : un titre, un corps.
        return (
          <Block key={s.id}>
            {title ? <h2 className="text-[24px]">{resolveTokens(title, book)}</h2> : null}
            {body ? (
              <div className="mt-4">
                <Paragraphs text={resolveTokens(body, book)} />
              </div>
            ) : null}
          </Block>
        );
      })}
    </div>
  );
}
