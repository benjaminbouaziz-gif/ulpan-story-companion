import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/context";
import { LANGS, type Lang } from "@/i18n/dictionaries";
import { Lamed } from "./Lamed";
import { ReadingSettings } from "./ReadingSettings";

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="label touch text-foreground flex items-center border-b-2 border-transparent"
      activeProps={{ className: "label touch flex items-center border-b-2 border-current" }}
    >
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="border-line bg-background sticky top-0 z-40 border-b">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-2">
        <Link to="/" className="touch flex items-center gap-2">
          <span className="text-[26px] leading-none">
            <Lamed />
          </span>
          <span className="label">{t("site.name")}</span>
        </Link>
        <div className="ml-auto">
          <ReadingSettings />
        </div>
      </div>
      <nav className="border-line mx-auto flex w-full max-w-3xl gap-5 overflow-x-auto border-t px-4">
        <NavLink to="/methode">{t("nav.method")}</NavLink>
        <NavLink to="/collections">{t("nav.collections")}</NavLink>
        <NavLink to="/compagnon">{t("nav.companion")}</NavLink>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const { t, lang, setLang } = useI18n();
  return (
    <footer className="border-line mt-16 border-t">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="body-text text-secondary-text">{t("site.support")}</p>

        <div className="mt-6 flex flex-col gap-2">
          <Link to="/mentions-legales" className="label touch flex items-center">
            {t("footer.legal")}
          </Link>
          <Link to="/confidentialite" className="label touch flex items-center">
            {t("footer.privacy")}
          </Link>
          <Link to="/contact" className="label touch flex items-center">
            {t("footer.contact")}
          </Link>
        </div>

        <div className="border-line mt-6 border-t pt-4">
          <p className="label text-secondary-text">{t("footer.lang")}</p>
          <div className="mt-2 flex gap-2">
            {LANGS.map((l: Lang) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`label touch border-line border px-3 ${
                  lang === l ? "bg-foreground text-background" : ""
                }`}
              >
                {l === "fr" ? "Français" : "English"}
              </button>
            ))}
          </div>
        </div>

        <p className="label text-secondary-text mt-6">{t("footer.rights")}</p>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
