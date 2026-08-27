import { createFileRoute, redirect } from "@tanstack/react-router";

/** « Mon compte » vit désormais dans la salle Réglages de l'atelier. */
export const Route = createFileRoute("/admin/compte")({
  beforeLoad: () => {
    throw redirect({ to: "/atelier/reglages", replace: true });
  },
  head: () => ({
    meta: [{ title: "Mon compte — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
});
