import { createFileRoute } from "@tanstack/react-router";
import { Room } from "@/components/AtelierRoom";

export const Route = createFileRoute("/atelier/reglages")({
  head: () => ({ meta: [{ title: "Réglages — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }] }),
  component: () => <Room titleKey="atelier.room.settings" descKey="atelier.room.settings.desc" />,
});
