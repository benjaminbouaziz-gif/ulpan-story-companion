import { createFileRoute, Link } from "@tanstack/react-router";
import { Room } from "@/components/AtelierRoom";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";

/**
 * Seule salle non vide de cette brique : elle mène aux trois outils du site
 * public, qui fonctionnent et restent inchangés jusqu'à leur réinstallation ici.
 */
export const Route = createFileRoute("/atelier/site")({
  head: () => ({
    meta: [{ title: "Site public — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: SiteRoom,
});

const TOOLS: { to: string; key: DictKey }[] = [
  { to: "/admin/extraits", key: "atelier.site.excerpt" },
  { to: "/admin/pages", key: "atelier.site.pages" },
  { to: "/admin/chiffres", key: "atelier.site.figures" },
];

function SiteRoom() {
  const { t } = useI18n();
  return (
    <Room titleKey="atelier.room.site" descKey="atelier.room.site.desc">
      <ul>
        {TOOLS.map((tool) => (
          <li key={tool.to} className="border-line border-b py-3 first:border-t-0">
            <Link to={tool.to} className="border-b border-current">
              {t(tool.key)}
            </Link>
            <span className="ml-3 text-[13px]">— {t("atelier.site.legacy")}</span>
          </li>
        ))}
      </ul>
    </Room>
  );
}
