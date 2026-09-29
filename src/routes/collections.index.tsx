import { createFileRoute } from "@tanstack/react-router";
import { collectionsRoute } from "@/vitrine/routes";

export const Route = createFileRoute("/collections/")(collectionsRoute());
