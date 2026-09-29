import { createFileRoute } from "@tanstack/react-router";
import { lecteurRoute } from "@/lecteur/routes";
import { CompagnonPage } from "@/compagnon/Page";

export const Route = createFileRoute("/companion/$slug")({
  ...lecteurRoute("compagnon", CompagnonPage),
  validateSearch: (s: Record<string, unknown>) => s,
});
