import { createFileRoute } from "@tanstack/react-router";
import { qrRoute } from "@/lecteur/routes";

export const Route = createFileRoute("/$slug")(qrRoute());
