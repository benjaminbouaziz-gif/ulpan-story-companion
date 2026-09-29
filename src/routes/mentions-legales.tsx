import { createFileRoute } from "@tanstack/react-router";
import { blocksRoute } from "@/vitrine/routes";

export const Route = createFileRoute("/mentions-legales")(blocksRoute("mentions", "mentions"));
