import { useI18n } from "@/i18n/context";
import { Lamed } from "./Lamed";
import { SiteLink } from "./SiteLink";

const navCls = "label whitespace-nowrap border-b border-transparent py-1 text-foreground";

export function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="border-line bg-background sticky z-30 border-b" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      <div className="frame flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
        <SiteLink page="accueil" className="flex items-center gap-2">
          <span className="text-[26px] leading-none">
            <Lamed />
          </span>
          <span className="label">{t("site.name")}</span>
        </SiteLink>
        <nav aria-label={t("nav.label")} className="ml-auto flex items-center gap-3 sm:gap-5">
          <SiteLink page="methode" className={navCls} activeClassName="!border-current">
            {t("nav.method")}
          </SiteLink>
          <span aria-hidden className="text-secondary-text">·</span>
          <SiteLink page="collections" className={navCls} activeClassName="!border-current">
            {t("nav.collections")}
          </SiteLink>
          <span aria-hidden className="text-secondary-text">·</span>
          <SiteLink page="espace_lecteur" className={navCls} activeClassName="!border-current">
            {t("nav.companion")}
          </SiteLink>
        </nav>
      </div>
    </header>
  );
}
