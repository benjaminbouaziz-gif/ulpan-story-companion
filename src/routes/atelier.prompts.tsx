import { createFileRoute } from "@tanstack/react-router";
import { Room } from "@/components/AtelierRoom";

export const Route = createFileRoute("/atelier/prompts")({
  head: () => ({ meta: [{ title: "Prompts — Atelier Ulpan Story" }, { name: "robots", content: "noindex" }] }),
  component: () => <Room titleKey="atelier.room.prompts" descKey="atelier.room.prompts.desc" />,
});
