import { createFileRoute, redirect } from "@tanstack/react-router";

/** /admin mène à l'atelier. */
export const Route = createFileRoute("/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/atelier", replace: true });
  },
  head: () => ({
    meta: [{ title: "Administration — Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
});
