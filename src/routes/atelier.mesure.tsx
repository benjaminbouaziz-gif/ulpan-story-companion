import { createFileRoute } from "@tanstack/react-router";
import { Room } from "@/components/AtelierRoom";

export const Route = createFileRoute("/atelier/mesure")({
  head: () => ({ meta: [{ title: "Mesure — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }] }),
  component: () => <Room titleKey="atelier.room.measure" descKey="atelier.room.measure.desc" />,
});
