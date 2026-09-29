import { createFileRoute } from "@tanstack/react-router";
import { homeRoute } from "@/vitrine/routes";

export const Route = createFileRoute("/")(homeRoute());
