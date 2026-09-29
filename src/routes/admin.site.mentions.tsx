import { createFileRoute } from "@tanstack/react-router";
import { PageSimple } from "@/admin/PageSimple";

export const Route = createFileRoute("/admin/site/mentions")({
  component: () => <PageSimple pageKey="mentions" titre="Mentions légales" />,
});
