import { createFileRoute, Link } from "@tanstack/react-router";
import { BlockEditor } from "@/admin/BlockEditor";
import { LangTabs } from "@/admin/LangTabs";
import { Section } from "@/admin/ui";
import { Apercu } from "@/admin/Apercu";
import { KINDS_BY_PAGE, type PageKey } from "@/lib/site-blocks";

export const Route = createFileRoute("/admin/site/accueil")({ component: Accueil });

const SECTIONS: { key: PageKey; titre: string; note?: string }[] = [
  { key: "accueil_ouverture", titre: "Ouverture" },
  { key: "accueil_methode", titre: "La méthode", note: "Les 4 images viennent de Site › Méthode." },
  { key: "accueil_livres", titre: "Les livres", note: "La liste se remplit automatiquement avec ce qui est publié et visible." },
  { key: "accueil_collections", titre: "Les collections", note: "La liste se remplit automatiquement avec ce qui est publié et visible." },
  { key: "accueil_lecteur", titre: "Vous avez le livre ?" },
  { key: "pied", titre: "Pied de page" },
];

function Accueil() {
  return (
    <div>
      <Link to="/admin/site" className="label text-secondary-text">← Site</Link>
      <h1 className="mt-2 text-[26px]">Accueil</h1>
      <LangTabs>
        {(lang) => <>
          <Apercu cible={{ kind: "accueil" }} lang={lang} />
          {SECTIONS.map((s) => (
          <Section key={s.key} title={s.titre}>
            <BlockEditor target={{ scope: "site", pageKey: s.key, lang }} kinds={KINDS_BY_PAGE[s.key]} />
            {s.note && <p className="text-secondary-text mt-2 text-[13px]">{s.note}</p>}
          </Section>
        ))}
        </>}
      </LangTabs>
    </div>
  );
}
