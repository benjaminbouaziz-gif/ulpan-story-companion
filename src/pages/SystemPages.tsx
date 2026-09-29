import { useRouter } from "@tanstack/react-router";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";
import { SiteLink } from "@/components/SiteLink";

const btn = "label border-line inline-flex items-center border px-4 py-2 text-foreground";

/** Page provisoire : titre + « Contenu à venir ». */
export function ComingSoonPage({ titleKey }: { titleKey: DictKey }) {
  const { t } = useI18n();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-[32px]">{t(titleKey)}</h1>
      <p className="text-secondary-text mt-3">{t("site.comingSoon")}</p>
    </main>
  );
}

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-[32px]">{t("notFound.title")}</h1>
      <p className="text-secondary-text mt-3">{t("notFound.body")}</p>
      <div className="mt-6">
        <SiteLink page="accueil" className={btn}>{t("notFound.home")}</SiteLink>
      </div>
    </main>
  );
}

export function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="text-[32px]">{t("error.title")}</h1>
      <p className="text-secondary-text mt-3">{t("error.body")}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className={btn}
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          {t("error.retry")}
        </button>
        <SiteLink page="accueil" className={btn}>{t("notFound.home")}</SiteLink>
      </div>
    </main>
  );
}
