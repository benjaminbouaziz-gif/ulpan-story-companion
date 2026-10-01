import { useMatches } from "@tanstack/react-router";
import { useI18n } from "@/i18n/context";
import { absoluteUrl, type PageId } from "@/i18n/routes";
import { contrast } from "@/lib/couleurs";
import { Lamed } from "./Lamed";
import { SiteLink } from "./SiteLink";

/** Bande décorative aux couleurs des collections visibles. */
export function BandeCollections({ colors }: { colors: string[] }) {
  const list = colors.length ? colors : ["var(--color-ink)"];
  return (
    <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: `repeat(${list.length}, 1fr)`, height: 10 }}>
      {list.map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </div>
  );
}

/** Couleur du lamed : première collection si contraste ≥ 3:1 sur le papier. */
export function lamedColor(colors: string[]): string {
  const c = colors[0];
  return c && contrast(c, "#fbfaf6") >= 3 ? c : "var(--color-foreground)";
}

/** Logo : lamed 52 px + « ULPAN STORY » + phrase facultative. */
export function SiteLogo({ colors, phrase }: { colors: string[]; phrase: string | null }) {
  const { t } = useI18n();
  return (
    <SiteLink page="accueil" className="flex items-center gap-3">
      <span style={{ fontSize: 52, color: lamedColor(colors) }} className="leading-none">
        <Lamed />
      </span>
      <span className="flex flex-col">
        <span style={{ fontSize: 15, letterSpacing: "0.24em", fontWeight: 600 }} className="uppercase">
          {t("site.name")}
        </span>
        {phrase && <span className="site-motto">{phrase}</span>}
      </span>
    </SiteLink>
  );
}

/** « FR · EN » : même page dans l'autre langue si elle existe, sinon accueil de l'autre domaine. */
export function ChoixLangue() {
  const { lang } = useI18n();
  const matches = useMatches();
  const leaf = [...matches].reverse().find((m) => m.staticData?.pageId);
  const pageId: PageId = leaf?.staticData?.pageId ?? "accueil";
  const params = (leaf?.params ?? {}) as Record<string, string>;
  const other = lang === "fr" ? "en" : "fr";
  const alt = (leaf?.loaderData as { alternateExists?: boolean } | undefined)?.alternateExists;
  const href = alt === false ? absoluteUrl("accueil", other) : absoluteUrl(pageId, other, params);
  const link = (
    <a href={href} hrefLang={other} lang={other} className="underline">
      {other.toUpperCase()}
    </a>
  );
  const cur = <span>{lang.toUpperCase()}</span>;
  return (
    <span className="label whitespace-nowrap">
      {lang === "fr" ? cur : link} · {lang === "fr" ? link : cur}
    </span>
  );
}
