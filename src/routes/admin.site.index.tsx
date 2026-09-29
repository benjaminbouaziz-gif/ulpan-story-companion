import { createFileRoute } from "@tanstack/react-router";
import { Prochainement } from "@/admin/ui";

export const Route = createFileRoute("/admin/site/")({
  component: () => (
    <div>
      <h1 className="text-[26px]">Site — Accueil, Méthode, Pages légales</h1>
      <div className="mt-4"><Prochainement /></div>
    </div>
  ),
});
