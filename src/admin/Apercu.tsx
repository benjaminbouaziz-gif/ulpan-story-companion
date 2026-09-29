import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { I18nProvider } from "@/i18n/context";
import { apercuBlocksPage, apercuBook, apercuCollection, apercuHome } from "@/lib/admin-apercu.functions";
import type { PageKey } from "@/lib/site-blocks";
import { BookPage, CollectionPage, HomePage, MethodPage, SimplePage } from "@/vitrine/Pages";
import { messageErreur } from "./textes";
import { btnCls } from "./ui";

type Lang = "fr" | "en";
export type ApercuCible =
  | { kind: "accueil" }
  | { kind: "methode" }
  | { kind: "simple"; pageKey: "contact" | "mentions" | "confidentialite" }
  | { kind: "collection"; collectionId: string }
  | { kind: "livre"; editionId: string };

/** Bouton « Aperçu » : la vraie page publique, dans la langue de l'onglet, non-publié compris. */
export function Apercu({ cible, lang }: { cible: ApercuCible; lang: Lang }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button type="button" className={btnCls} onClick={() => setOpen(!open)}>{open ? "Fermer l'aperçu" : "Aperçu de la page"}</button>
      {open && <Vue cible={cible} lang={lang} />}
    </div>
  );
}

function Vue({ cible, lang }: { cible: ApercuCible; lang: Lang }) {
  const home = useServerFn(apercuHome);
  const blocks = useServerFn(apercuBlocksPage);
  const coll = useServerFn(apercuCollection);
  const book = useServerFn(apercuBook);
  const q = useQuery({
    queryKey: ["admin", "apercu", cible, lang],
    queryFn: async (): Promise<{ hidden: boolean; node: ReactNode } | null> => {
      if (cible.kind === "accueil") { const d = await home({ data: { lang } }); return { hidden: d.hidden, node: <HomePage d={d} /> }; }
      if (cible.kind === "methode") { const d = await blocks({ data: { lang, pageKey: "methode", withSteps: true } }); return { hidden: d.hidden, node: <MethodPage d={d} /> }; }
      if (cible.kind === "simple") {
        const d = await blocks({ data: { lang, pageKey: cible.pageKey as PageKey } });
        return { hidden: d.hidden, node: <SimplePage d={d} titleKey={`page.${cible.pageKey}`} /> };
      }
      if (cible.kind === "collection") { const d = await coll({ data: { lang, collectionId: cible.collectionId } }); return d && { hidden: d.hidden, node: <CollectionPage d={d} /> }; }
      const d = await book({ data: { lang, editionId: cible.editionId } });
      return d && { hidden: d.hidden, node: <BookPage d={d} /> };
    },
    staleTime: 0,
  });
  if (q.isLoading) return <p className="mt-3">…</p>;
  if (q.error) return <p className="mt-3">{messageErreur(q.error)}</p>;
  if (!q.data) return <p className="mt-3">Rien à afficher.</p>;
  return (
    <div className="border-line bg-background mt-3 border">
      {q.data.hidden && <p className="bg-alert-soft text-alert label px-4 py-2">Aperçu — non publié</p>}
      <I18nProvider lang={lang}>{q.data.node}</I18nProvider>
    </div>
  );
}
