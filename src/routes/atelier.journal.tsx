import { createFileRoute } from "@tanstack/react-router";
import { Room } from "@/components/AtelierRoom";

export const Route = createFileRoute("/atelier/journal")({
  head: () => ({ meta: [{ title: "Journal — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }] }),
  component: () => <Room titleKey="atelier.room.journal" descKey="atelier.room.journal.desc" />,
});
