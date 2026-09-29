import { createFileRoute } from "@tanstack/react-router";
import { alwaysNotFound } from "@/lib/page-route";

export const Route = createFileRoute("/collections/$slug")(alwaysNotFound("collection"));
