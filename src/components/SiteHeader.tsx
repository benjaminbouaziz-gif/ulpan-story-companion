import { useI18n } from "@/i18n/context";
import { BandeCollections, ChoixLangue, SiteLogo } from "./BandeCollections";
import { SiteLink } from "./SiteLink";

const navCls = "whitespace-nowrap border-b-2 border-transparent py-1 text-foreground";

export function SiteHeader({ stripe }: { stripe: string[] }) {
  const { t } = useI18n();
  return (
    <header>
      <div className="site-bar">
        <div className="frame site-bar-in">
          <span className="label">{t("header.kicker")}</span>
          <ChoixLangue />
        </div>
      </div>
      <div className="site-row">
        <div className="frame site-row-in">
          <SiteLogo colors={stripe} phrase={t("header.motto")} />
          <nav aria-label={t("nav.label")} className="site-nav">
            <SiteLink page="accueil" className={navCls} activeClassName="!border-current">{t("page.accueil")}</SiteLink>
            <SiteLink page="methode" className={navCls} activeClassName="!border-current">{t("nav.method")}</SiteLink>
            <SiteLink page="collections" className={navCls} activeClassName="!border-current">{t("nav.collections")}</SiteLink>
            <SiteLink page="espace_lecteur" className="site-cta whitespace-nowrap">{t("nav.companion")}</SiteLink>
          </nav>
        </div>
      </div>
      <BandeCollections colors={stripe} />
    </header>
  );
}
