import { createFileRoute } from "@tanstack/react-router";
import { espaceRoute } from "@/lecteur/routes";

export const Route = createFileRoute("/compagnon/")(espaceRoute());
