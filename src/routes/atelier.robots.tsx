import { createFileRoute } from "@tanstack/react-router";
import { Room } from "@/components/AtelierRoom";

export const Route = createFileRoute("/atelier/robots")({
  head: () => ({ meta: [{ title: "Robots — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }] }),
  component: () => <Room titleKey="atelier.room.robots" descKey="atelier.room.robots.desc" />,
});
