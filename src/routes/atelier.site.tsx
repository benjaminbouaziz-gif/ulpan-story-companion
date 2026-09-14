import { createFileRoute, Outlet } from "@tanstack/react-router";

/** La salle Site : son sommaire et les trois écrans du contenu public. */
export const Route = createFileRoute("/atelier/site")({
  head: () => ({
    meta: [{ title: "Site public — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <Outlet />,
});
