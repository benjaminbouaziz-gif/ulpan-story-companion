import type { ReactNode } from "react";
import { pickLang, useI18n } from "@/i18n/context";
import type { Book, PageSection, SpreadBundle } from "@/lib/catalog.functions";
import { SpreadSection } from "./SpreadSection";

/**
 * Le rendu des sections d'une page éditoriale. Aucune phrase n'est écrite ici :
 * tout vient de page_sections, et se modifie depuis l'administration. Vider la
 * table vide la page.
 */

type Json = Record<string, unknown>;

function sectionData(section: PageSection): Json {
  return (section.data ?? {}) as Json;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/**
 * {{book.chapters_count}}, {{book.words_unique}}, {{book.spread_pages}}.
 * Renvoie null si un jeton ne résout pas : l'appelant masque la ligne.
 */
export function resolveTokens(value: string, book: Book | null | undefined): string | null {
  let failed = false;
  const out = value.replace(/\{\{\s*book\.([a-z_]+)\s*\}\}/gi, (_m, field: string) => {
    if (!book) {
      failed = true;
      return "";
    }
    if (field === "spread_pages") {
      // Chiffre saisi dans l'admin ; le comptage n'est qu'une indication là-bas.
      const saisi = book.spread_pages ?? null;
      if (saisi === null || saisi === undefined) {
        failed = true;
        return "";
      }
      return String(saisi);
    }
    const raw = (book as unknown as Record<string, unknown>)[field];
    if (raw === null || raw === undefined || raw === "") {
      failed = true;
      return "";
    }
    return String(raw);
  });
  return failed ? null : out;
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

/** Colonne de lecture : ~65 caractères, centrée. */
function Column({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[65ch]">{children}</div>;
}

function Block({
  children,
  rule,
  first,
}: {
  children: ReactNode;
  rule: string | null;
  first: boolean;
}) {
  return (
    <section className="mt-16 first:mt-0">
      {first ? null : (
        <div className="mx-auto mb-16 w-full max-w-[65ch]">
          <hr
            className="h-px w-16 border-0"
            style={{ background: rule ?? "var(--color-line)" }}
            aria-hidden
          />
        </div>
      )}
      {children}
    </section>
  );
}

export function PageSections({
  sections,
  books,
  colors,
  spreads,
}: {
  sections: PageSection[];
  books: Record<string, Book>;
  colors: Record<string, string | null>;
  spreads: Record<string, SpreadBundle>;
}) {
  const { t, lang } = useI18n();
  if (sections.length === 0)
    return (
      <Column>
        <p className="body-text">{t("empty.page")}</p>
      </Column>
    );

  return (
    <div>
      {sections.map((s, si) => {
        const d = sectionData(s);
        const bookId = str(d["book_id"]);
        const book = bookId ? books[bookId] : undefined;
        const color = (bookId ? colors[bookId] : null) ?? null;
        const rawTitle = pickLang(lang, s.title_fr, s.title_en);
        const rawBody = pickLang(lang, s.body_fr, s.body_en);
        const title = rawTitle ? resolveTokens(rawTitle, book) : null;
        const body = rawBody ? resolveTokens(rawBody, book) : null;
        const separator = color;

        if (s.kind === "book_spread") {
          const bundle = bookId ? spreads[bookId] : undefined;
          if (!bundle) return null;
          const b = bundle.book;
          return (
            <Block key={s.id} rule={separator} first={si === 0}>
              {title ? (
                <Column>
                  <p style={{ fontSize: "calc(19px * var(--text-scale))", lineHeight: 1.55 }}>
                    {title}
                  </p>
                </Column>
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
          const resolved = facts
            .map((f) => ({
              value: resolveTokens(str(f["value"]) ?? "", book),
              label: pickLang(lang, str(f["label_fr"]), str(f["label_en"])),
            }))
            .filter((f): f is { value: string; label: string | null } => Boolean(f.value));
          return (
            <Block key={s.id} rule={separator} first={si === 0}>
              <Column>
                {title ? <h2 className="text-[24px]">{title}</h2> : null}
                <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
                  {resolved.map((f, i) => (
                    <div key={i}>
                      <dt
                        className="tabular-nums whitespace-nowrap"
                        style={{
                          fontFamily: "var(--font-latin)",
                          fontSize: "calc(34px * var(--text-scale))",
                          lineHeight: 1.1,
                          color: color ?? "var(--color-foreground)",
                        }}
                      >
                        {f.value}
                      </dt>
                      <dd className="label text-secondary-text mt-2">{f.label ?? ""}</dd>
                    </div>
                  ))}
                </dl>
                {body ? (
                  <div className="mt-10">
                    <Paragraphs text={body} />
                  </div>
                ) : null}
              </Column>
            </Block>
          );
        }

        if (s.kind === "steps") {
          const steps = Array.isArray(d["steps"]) ? (d["steps"] as Json[]) : [];
          return (
            <Block key={s.id} rule={separator} first={si === 0}>
              <Column>
                {title ? <h2 className="text-[24px]">{title}</h2> : null}
                <ol className="mt-8">
                  {steps.map((st, i) => (
                    <li key={i} className="border-line mt-8 border-t pt-4 first:mt-0">
                      <p className="label" style={{ color: color ?? undefined }}>
                        {pickLang(lang, str(st["label_fr"]), str(st["label_en"])) ??
                          String(st["n"] ?? i + 1)}
                      </p>
                      <div className="mt-3">
                        <Paragraphs
                          text={pickLang(lang, str(st["body_fr"]), str(st["body_en"])) ?? ""}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
                {body ? (
                  <div className="mt-8">
                    <Paragraphs text={body} />
                  </div>
                ) : null}
              </Column>
            </Block>
          );
        }

        if (s.kind === "faq") {
          const items = Array.isArray(d["items"]) ? (d["items"] as Json[]) : [];
          return (
            <Block key={s.id} rule={separator} first={si === 0}>
              <Column>
                {title ? <h2 className="text-[24px]">{title}</h2> : null}
                <dl className="mt-6">
                  {items.map((it, i) => (
                    <div key={i} className="border-line mt-6 border-t pt-4">
                      <dt className="body-text">
                        {pickLang(lang, str(it["q_fr"]), str(it["q_en"])) ?? ""}
                      </dt>
                      <dd className="body-text text-secondary-text mt-2">
                        {pickLang(lang, str(it["a_fr"]), str(it["a_en"])) ?? ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Column>
            </Block>
          );
        }

        if (s.kind === "quote") {
          return (
            <Block key={s.id} rule={separator} first={si === 0}>
              <Column>
                <blockquote
                  className="border-line border-l-2 pl-4"
                  style={{ fontSize: "calc(21px * var(--text-scale))", lineHeight: 1.5 }}
                >
                  {body ?? title ?? ""}
                </blockquote>
              </Column>
            </Block>
          );
        }

        if (s.kind === "heading") {
          return (
            <Block key={s.id} rule={separator} first={si === 0}>
              <Column>
                <h2 className="text-[24px]">{title ?? ""}</h2>
              </Column>
            </Block>
          );
        }

        // richtext et tout le reste : un titre, un corps.
        return (
          <Block key={s.id} rule={separator} first={si === 0}>
            <Column>
              {title ? <h2 className="text-[24px]">{title}</h2> : null}
              {body ? (
                <div className="mt-5">
                  <Paragraphs text={body} />
                </div>
              ) : null}
            </Column>
          </Block>
        );
      })}
    </div>
  );
}
