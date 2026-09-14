import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * L'ancienne administration n'existe plus : tout se pilote depuis l'atelier.
 * Les adresses connues mènent à leur équivalent, le reste aux livres.
 */
const CIBLES: Record<string, string> = {
  pages: "/atelier/site/pages",
  extraits: "/atelier/site/extraits",
  chiffres: "/atelier/site/chiffres",
  compte: "/atelier/reglages",
  "": "/atelier",
};

export const Route = createFileRoute("/admin/$")({
  beforeLoad: ({ params }) => {
    const reste = (params._splat ?? "").replace(/^\/+|\/+$/g, "");
    throw redirect({ to: CIBLES[reste] ?? "/atelier/livres", replace: true });
  },
  head: () => ({
    meta: [{ title: "Administration — Ulpan Story" }, { name: "robots", content: "noindex" }],
  }),
});
