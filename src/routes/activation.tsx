import { createFileRoute } from "@tanstack/react-router";
import { comingSoon } from "@/lib/page-route";

export const Route = createFileRoute("/activation")(comingSoon("activation", { noindex: true }));
