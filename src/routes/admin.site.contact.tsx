import { createFileRoute } from "@tanstack/react-router";
import { PageSimple } from "@/admin/PageSimple";

export const Route = createFileRoute("/admin/site/contact")({
  component: () => <PageSimple pageKey="contact" titre="Contact" />,
});
