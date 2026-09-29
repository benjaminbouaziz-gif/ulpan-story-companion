import { createFileRoute } from "@tanstack/react-router";
import { collectionRoute } from "@/vitrine/routes";

export const Route = createFileRoute("/collections/$slug")(collectionRoute());
