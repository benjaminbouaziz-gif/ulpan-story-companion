import { pickLang, useI18n } from "@/i18n/context";
import type { PageSection } from "@/lib/catalog.functions";

/**
 * Le texte rédactionnel des pages du site, lu en base (page_sections).
 * Aucune phrase n'est écrite ici : vider la table vide la page.
 *
 * Une section peut porter une étiquette data.slot : elle indique à quel endroit
 * de la page elle s'affiche, car certaines pages intercalent des listes lues en
 * base (collections, tomes) entre leurs textes.
 */

function slotOf(section: PageSection): string | null {
  const data = (section.data ?? {}) as Record<string, unknown>;
  const slot = data["slot"];
  return typeof slot === "string" && slot.trim() ? slot : null;
}

export function bySlot(sections: PageSection[], slot: string): PageSection[] {
  return sections.filter((s) => slotOf(s) === slot);
}

export function withoutSlot(sections: PageSection[]): PageSection[] {
  return sections.filter((s) => slotOf(s) === null);
}

const TITLE_CLASS: Record<"h1" | "h2" | "h3", string> = {
  h1: "text-[34px]",
  h2: "text-[24px]",
  h3: "text-[20px]",
};

export function Copy({
  sections,
  level = "h2",
}: {
  sections: PageSection[];
  level?: "h1" | "h2" | "h3";
}) {
  const { lang } = useI18n();
  // Une section peut n'exister que dans une langue : ce n'est pas un manque.
  const visible = sections.filter((s) => {
    const locales = Array.isArray(s.locales) && s.locales.length > 0 ? s.locales : ["fr", "en"];
    return locales.includes(lang);
  });

  return (
    <>
      {visible.map((s) => {
        const title = pickLang(lang, s.title_fr, s.title_en);
        const body = pickLang(lang, s.body_fr, s.body_en);
        const Title = level;
        return (
          <div key={s.id} className="first:mt-0">
            {title ? <Title className={TITLE_CLASS[level]}>{title}</Title> : null}
            {body
              ? body
                  .split(/\n\s*\n/)
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((p, i) => (
                    <p key={i} className="body-text mt-4">
                      {p}
                    </p>
                  ))
              : null}
          </div>
        );
      })}
    </>
  );
}
