import { createFileRoute } from "@tanstack/react-router";
import { Room } from "@/components/AtelierRoom";

export const Route = createFileRoute("/atelier/collections")({
  head: () => ({ meta: [{ title: "Collections — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }] }),
  component: () => <Room titleKey="atelier.room.collections" descKey="atelier.room.collections.desc" />,
});
