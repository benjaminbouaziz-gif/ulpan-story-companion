import { createFileRoute, Link } from "@tanstack/react-router";
import { Room } from "@/components/AtelierRoom";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";

/** Le sommaire de la salle Site : les trois écrans du contenu public. */
export const Route = createFileRoute("/atelier/site/")({
  head: () => ({
    meta: [{ title: "Site public — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: SiteRoom,
});

const TOOLS: { to: string; key: DictKey; descKey: DictKey }[] = [
  { to: "/atelier/site/pages", key: "atelier.site.pages", descKey: "atelier.site.pages.desc" },
  {
    to: "/atelier/site/extraits",
    key: "atelier.site.excerpt",
    descKey: "atelier.site.excerpt.desc",
  },
  {
    to: "/atelier/site/chiffres",
    key: "atelier.site.figures",
    descKey: "atelier.site.figures.desc",
  },
];

function SiteRoom() {
  const { t } = useI18n();
  return (
    <Room titleKey="atelier.room.site" descKey="atelier.room.site.desc">
      <ul>
        {TOOLS.map((tool) => (
          <li key={tool.to} className="border-line border-b py-3">
            <Link to={tool.to} className="border-b border-current">
              {t(tool.key)}
            </Link>
            <span className="ml-3 text-[13px]">— {t(tool.descKey)}</span>
          </li>
        ))}
      </ul>
    </Room>
  );
}
