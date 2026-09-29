import { createFileRoute } from "@tanstack/react-router";
import { comingSoon } from "@/lib/page-route";

export const Route = createFileRoute("/companion/")(comingSoon("espace_lecteur", { noindex: true }));
