import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { StepDossier } from "@/components/AtelierStepDossier";
import { useI18n } from "@/i18n/context";

/**
 * Le dossier d'étape appartenait à la fabrication par robots : il n'est plus
 * au menu et son adresse ramène aux livres. Le code reste en place.
 */
export const Route = createFileRoute("/atelier/etape/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/atelier/livres" });
  },
  head: () => ({
    meta: [
      { title: "Dossier d'étape — Atelier Ulpan Story" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StepDossierRoom,
});

function StepDossierRoom() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  return (
    <section className="max-w-[900px]">
      <h1 className="font-latin text-[24px]">{t("atelier.dossier.title")}</h1>
      <p className="mt-2 text-[13px]">
        <Link to="/atelier" className="border-b border-current">
          {t("atelier.dossier.back")}
        </Link>
      </p>
      <div className="border-line mt-6 border-t pt-4">
        <StepDossier bookStepId={id} />
      </div>
    </section>
  );
}
