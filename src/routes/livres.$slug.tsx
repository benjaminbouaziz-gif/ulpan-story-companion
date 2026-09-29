import { createFileRoute } from "@tanstack/react-router";
import { bookRoute } from "@/vitrine/routes";

export const Route = createFileRoute("/livres/$slug")(bookRoute());
