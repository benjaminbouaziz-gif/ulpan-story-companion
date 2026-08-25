import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, type DictKey, type Lang } from "./dictionaries";

const STORAGE_KEY = "ulpanstory.lang";

type I18nValue = {
  lang: Lang;
  t: (key: DictKey) => string;
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // Préférence forcée par le lecteur : lue après hydratation.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback((key: DictKey) => dictionaries[lang][key] ?? key, [lang]);

  return <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

/** Choisit la colonne éditoriale correspondant à la langue courante. */
export function pickLang<T>(lang: Lang, fr: T | null | undefined, en: T | null | undefined): T | null {
  const primary = lang === "en" ? en : fr;
  const fallback = lang === "en" ? fr : en;
  return (primary ?? fallback) ?? null;
}
