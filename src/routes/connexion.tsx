import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/SiteChrome";
import { Copy } from "@/components/SiteCopy";
import { useI18n } from "@/i18n/context";
import { pageQuery } from "@/lib/queries";

const PAGE = "connexion";

export const Route = createFileRoute("/connexion")({
  head: () => ({
    meta: [
      { title: "Connexion — Ulpan Story" },
      {
        name: "description",
        content: "Recevez un lien de connexion par email. Aucun mot de passe.",
      },
      { property: "og:title", content: "Connexion — Ulpan Story" },
      { property: "og:description", content: "Un lien par email, aucun mot de passe." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pageQuery(PAGE)),
  component: SignInPage,
});

function SignInPage() {
  const { t } = useI18n();
  const { data } = useSuspenseQuery(pageQuery(PAGE));
  return (
    <PageShell>
      <h1 className="text-[30px]">{t("nav.companion")}</h1>
      <div className="mt-6">
        {data.sections.length === 0 ? (
          <p className="body-text text-secondary-text">{t("soon")}</p>
        ) : (
          <Copy sections={data.sections} />
        )}
      </div>
    </PageShell>
  );
}
