import { createFileRoute } from "@tanstack/react-router";
import { comingSoon } from "@/lib/page-route";

export const Route = createFileRoute("/compagnon/")(comingSoon("espace_lecteur", { noindex: true }));
