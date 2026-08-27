import { createFileRoute } from "@tanstack/react-router";
import { Room } from "@/components/AtelierRoom";

export const Route = createFileRoute("/atelier/lecteurs")({
  head: () => ({ meta: [{ title: "Lecteurs — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }] }),
  component: () => <Room titleKey="atelier.room.readers" descKey="atelier.room.readers.desc" />,
});
