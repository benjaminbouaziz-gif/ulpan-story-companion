import { createFileRoute, Outlet } from "@tanstack/react-router";

/** L'administration est un simple conteneur : chaque outil est une route enfant. */
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Ulpan Story" },
      { name: "description", content: "Administration interne d'Ulpan Story." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Outlet />,
});
