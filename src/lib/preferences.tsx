import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type TextSize = "normal" | "grand" | "tres-grand";
export type Theme = "ivory" | "night";

const KEY_SIZE = "ulpanstory.textSize";
const KEY_THEME = "ulpanstory.theme";

type PrefsValue = {
  textSize: TextSize;
  theme: Theme;
  setTextSize: (v: TextSize) => void;
  setTheme: (v: Theme) => void;
};

const PrefsContext = createContext<PrefsValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [textSize, setSize] = useState<TextSize>("normal");
  const [theme, setThemeState] = useState<Theme>("ivory");

  useEffect(() => {
    const s = window.localStorage.getItem(KEY_SIZE);
    if (s === "normal" || s === "grand" || s === "tres-grand") setSize(s);
    const t = window.localStorage.getItem(KEY_THEME);
    if (t === "ivory" || t === "night") setThemeState(t);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.textSize = textSize;
  }, [textSize]);

  useEffect(() => {
    document.documentElement.classList.toggle("night", theme === "night");
  }, [theme]);

  const setTextSize = useCallback((v: TextSize) => {
    window.localStorage.setItem(KEY_SIZE, v);
    setSize(v);
  }, []);

  const setTheme = useCallback((v: Theme) => {
    window.localStorage.setItem(KEY_THEME, v);
    setThemeState(v);
  }, []);

  return (
    <PrefsContext.Provider value={{ textSize, theme, setTextSize, setTheme }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePreferences(): PrefsValue {
  const value = useContext(PrefsContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
