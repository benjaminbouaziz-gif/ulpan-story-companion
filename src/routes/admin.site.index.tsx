import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/site/")({ component: Menu });

const PAGES = [
  { to: "/admin/site/accueil", label: "Accueil (et pied de page)" },
  { to: "/admin/site/methode", label: "Méthode" },
  { to: "/admin/site/contact", label: "Contact" },
  { to: "/admin/site/mentions", label: "Mentions légales" },
  { to: "/admin/site/confidentialite", label: "Confidentialité" },
] as const;

function Menu() {
  return (
    <div>
      <h1 className="text-[26px]">Site</h1>
      <ul className="mt-4 space-y-2">
        {PAGES.map((p) => <li key={p.to}><Link to={p.to} className="underline">{p.label}</Link></li>)}
      </ul>
    </div>
  );
}
