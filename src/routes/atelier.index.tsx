import { createFileRoute } from "@tanstack/react-router";
import { Room } from "@/components/AtelierRoom";

export const Route = createFileRoute("/atelier/")({
  head: () => ({ meta: [{ title: "Tableau de bord — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }] }),
  component: () => <Room titleKey="atelier.room.dashboard" descKey="atelier.room.dashboard.desc" />,
});
