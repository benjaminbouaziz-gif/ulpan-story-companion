import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type TextSize = "normal" | "grand" | "tres-grand";
export type Theme = "ivory" | "night";

const KEY_SIZE = "ulpanstory.textSize";
const KEY_THEME = "ulpanstory.theme";
/** La vitesse d'écoute du lecteur : elle vit ici, pas dans un stockage à part. */
const KEY_SPEED = "ulpanstory.vitesse";
const SPEED_FALLBACK = 0.9;

type PrefsValue = {
  textSize: TextSize;
  theme: Theme;
  speed: number;
  setTextSize: (v: TextSize) => void;
  setTheme: (v: Theme) => void;
  setSpeed: (v: number) => void;
};

const PrefsContext = createContext<PrefsValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [textSize, setSize] = useState<TextSize>("normal");
  const [theme, setThemeState] = useState<Theme>("ivory");
  const [speed, setSpeedState] = useState<number>(SPEED_FALLBACK);

  useEffect(() => {
    const s = window.localStorage.getItem(KEY_SIZE);
    if (s === "normal" || s === "grand" || s === "tres-grand") setSize(s);
    const t = window.localStorage.getItem(KEY_THEME);
    if (t === "ivory" || t === "night") setThemeState(t);
    const v = Number(window.localStorage.getItem(KEY_SPEED));
    if (Number.isFinite(v) && v >= 0.75 && v <= 1) setSpeedState(v);
  }, []);

  useEffect(() => {
    document.documentElement.dataset["textSize"] = textSize;
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

  const setSpeed = useCallback((v: number) => {
    window.localStorage.setItem(KEY_SPEED, String(v));
    setSpeedState(v);
  }, []);

  return (
    <PrefsContext.Provider value={{ textSize, theme, speed, setTextSize, setTheme, setSpeed }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePreferences(): PrefsValue {
  const value = useContext(PrefsContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
