import { useI18n } from "@/i18n/context";
import { BandeCollections, ChoixLangue, SiteLogo } from "./BandeCollections";
import { SiteLink } from "./SiteLink";

const navCls = "whitespace-nowrap py-1 border-b-2 border-transparent text-foreground hover:underline";

export function SiteFooter({ tagline, stripe }: { tagline: string | null; stripe: string[] }) {
  const { t } = useI18n();
  return (
    <footer className="mt-16">
      <BandeCollections colors={stripe} />
      <div className="site-row">
        <div className="frame site-row-in">
          <SiteLogo colors={stripe} phrase={tagline} />
          <nav aria-label={t("nav.label")} className="site-nav">
            <SiteLink page="methode" className={navCls}>{t("nav.method")}</SiteLink>
            <SiteLink page="collections" className={navCls}>{t("nav.collections")}</SiteLink>
            <SiteLink page="espace_lecteur" className={navCls}>{t("nav.companion")}</SiteLink>
            <SiteLink page="contact" className={navCls}>{t("footer.contact")}</SiteLink>
          </nav>
        </div>
      </div>
      <div className="site-bar">
        <div className="frame site-bar-in">
          <span className="label">
            © Ulpan Story {new Date().getFullYear()} ·{" "}
            <SiteLink page="mentions" className="underline">{t("footer.mentions")}</SiteLink> ·{" "}
            <SiteLink page="confidentialite" className="underline">{t("footer.privacy")}</SiteLink>
          </span>
          <ChoixLangue />
        </div>
      </div>
    </footer>
  );
}
