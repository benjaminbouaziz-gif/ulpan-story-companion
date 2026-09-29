import { createFileRoute } from "@tanstack/react-router";
import { PageSimple } from "@/admin/PageSimple";

export const Route = createFileRoute("/admin/site/confidentialite")({
  component: () => <PageSimple pageKey="confidentialite" titre="Confidentialité" />,
});
