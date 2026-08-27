import { createFileRoute, redirect } from "@tanstack/react-router";

/** L'ancienne accueil d'administration n'était qu'une liste de liens : elle mène
 *  désormais à l'atelier, où les salles remplacent ces liens. */
export const Route = createFileRoute("/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/atelier", replace: true });
  },
  head: () => ({
    meta: [{ title: "Administration — Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
});
