import { useMatches } from "@tanstack/react-router";
import { useI18n } from "@/i18n/context";
import { absoluteUrl, type PageId } from "@/i18n/routes";
import { SiteLink } from "./SiteLink";

const linkCls = "label text-foreground hover:underline";

export function SiteFooter({ tagline }: { tagline: string | null }) {
  const { t, lang } = useI18n();
  const matches = useMatches();
  const leaf = [...matches].reverse().find((m) => m.staticData?.pageId);
  const pageId: PageId = leaf?.staticData?.pageId ?? "accueil";
  const params = (leaf?.params ?? {}) as Record<string, string>;
  const other = lang === "fr" ? "en" : "fr";
  const otherHref = absoluteUrl(pageId, other, params);

  return (
    <footer className="border-line mt-16 border-t">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6">
        {tagline && <p className="text-secondary-text">{tagline}</p>}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <SiteLink page="contact" className={linkCls}>{t("footer.contact")}</SiteLink>
          <SiteLink page="mentions" className={linkCls}>{t("footer.mentions")}</SiteLink>
          <SiteLink page="confidentialite" className={linkCls}>{t("footer.privacy")}</SiteLink>
          <a href={otherHref} hrefLang={other} lang={other} className={linkCls}>
            {t("footer.otherLang")}
          </a>
        </div>
        <p className="text-secondary-text text-sm">© Ulpan Story {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
