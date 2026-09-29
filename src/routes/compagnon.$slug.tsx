import { createFileRoute } from "@tanstack/react-router";
import { alwaysNotFound } from "@/lib/page-route";

export const Route = createFileRoute("/compagnon/$slug")(alwaysNotFound("compagnon"));
