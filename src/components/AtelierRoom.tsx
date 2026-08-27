import type { ReactNode } from "react";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n/dictionaries";

/**
 * Une salle de l'atelier : son titre, une phrase qui dit ce qu'elle contiendra,
 * puis le mot « vide » tant qu'aucune donnée n'y est branchée. Rien n'est
 * inventé ici : pas de tableau factice, pas de graphique décoratif.
 */
export function Room({
  titleKey,
  descKey,
  children,
}: {
  titleKey: DictKey;
  descKey: DictKey;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="max-w-[900px]">
      <h1 className="font-latin text-[24px]">{t(titleKey)}</h1>
      <p className="mt-2 text-[14px]">{t(descKey)}</p>
      <div className="border-line mt-6 border-t pt-4 text-[14px]">{children ?? <p>{t("atelier.empty")}</p>}</div>
    </section>
  );
}
