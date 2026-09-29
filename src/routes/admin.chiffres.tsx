import { createFileRoute } from "@tanstack/react-router";
import { Prochainement } from "@/admin/ui";

export const Route = createFileRoute("/admin/chiffres")({
  component: () => (
    <div>
      <h1 className="text-[26px]">Chiffres</h1>
      <div className="mt-4"><Prochainement /></div>
    </div>
  ),
});
