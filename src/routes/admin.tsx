import { createFileRoute } from "@tanstack/react-router";

// Page vide réservée ; l'accès protégé arrive en phase 2.
export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Ulpan Story" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: () => null,
});
