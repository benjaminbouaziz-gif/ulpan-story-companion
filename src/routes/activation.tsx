import { createFileRoute } from "@tanstack/react-router";
import { activationRoute } from "@/lecteur/routes";

export const Route = createFileRoute("/activation")(activationRoute());
