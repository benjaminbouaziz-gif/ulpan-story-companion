import { createFileRoute } from "@tanstack/react-router";
import { desinscriptionRoute } from "@/lecteur/routes";

export const Route = createFileRoute("/unsubscribe")(desinscriptionRoute());
