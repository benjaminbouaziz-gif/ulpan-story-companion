import { createContext, useCallback, useContext, type ReactNode } from "react";
import { dictionaries, type DictKey, type Lang } from "./dictionaries";

type I18nValue = {
  lang: Lang;
  t: (key: DictKey) => string;
};

// Un seul contexte, même quand le module est rechargé à chaud pendant l'édition.
const g = globalThis as { __ulpanI18nContext?: React.Context<I18nValue | null> };
const I18nContext = (g.__ulpanI18nContext ??= createContext<I18nValue | null>(null));

/** La langue est fixée par le domaine : aucun changement sur place. */
export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = useCallback((key: DictKey) => dictionaries[lang][key] ?? key, [lang]);
  return <I18nContext.Provider value={{ lang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

/** La colonne de la langue courante, et elle seule. Jamais de repli. */
export function pickLang<T>(lang: Lang, fr: T | null | undefined, en: T | null | undefined): T | null {
  const v = lang === "en" ? en : fr;
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}
