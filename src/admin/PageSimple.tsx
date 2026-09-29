import { Link } from "@tanstack/react-router";
import { BlockEditor } from "@/admin/BlockEditor";
import { LangTabs } from "@/admin/LangTabs";
import { KINDS_BY_PAGE, type PageKey } from "@/lib/site-blocks";

/** Écran d'une page du site faite d'un seul éditeur de blocs (Contact, pages légales). */
export function PageSimple({ pageKey, titre }: { pageKey: PageKey; titre: string }) {
  return (
    <div>
      <Link to="/admin/site" className="label text-secondary-text">← Site</Link>
      <h1 className="mt-2 text-[26px]">{titre}</h1>
      <LangTabs>{(lang) => <BlockEditor target={{ scope: "site", pageKey, lang }} kinds={KINDS_BY_PAGE[pageKey]} />}</LangTabs>
    </div>
  );
}
