import { createFileRoute } from "@tanstack/react-router";
import { Lamed } from "@/components/Lamed";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ulpan Story — Site en reconstruction" },
      { name: "description", content: "Ulpan Story, livres pour apprendre l'hébreu. Site en reconstruction." },
      { property: "og:title", content: "Ulpan Story — Site en reconstruction" },
      { property: "og:description", content: "Ulpan Story, livres pour apprendre l'hébreu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Accueil,
});

function Accueil() {
  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Lamed className="text-[72px]" />
      <h1 className="text-[28px]">Ulpan Story</h1>
      <p className="text-secondary-text">Site en reconstruction</p>
    </main>
  );
}
