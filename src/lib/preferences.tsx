import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Réglages de lecture du compagnon, retenus sur l'appareil. Le fournisseur
 * n'est monté que dans le compagnon : en le quittant, la page revient à
 * l'affichage normal (taille et mode nuit retirés).
 */
export type TextSize = "normal" | "grand" | "tres-grand";
export type Theme = "ivory" | "night";
export const SPEEDS = [0.75, 0.8, 0.9, 1] as const;

const KEY_SIZE = "ulpanstory.textSize";
const KEY_THEME = "ulpanstory.theme";
const KEY_SPEED = "ulpanstory.vitesse";
const KEY_AUTO = "ulpanstory.enchainer";
const SPEED_DEFAULT = 0.9;

type PrefsValue = {
  textSize: TextSize;
  theme: Theme;
  speed: number;
  autoAdvance: boolean;
  setTextSize: (v: TextSize) => void;
  setTheme: (v: Theme) => void;
  setSpeed: (v: number) => void;
  setAutoAdvance: (v: boolean) => void;
};

const PrefsContext = createContext<PrefsValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [textSize, setSize] = useState<TextSize>("normal");
  const [theme, setThemeState] = useState<Theme>("ivory");
  const [speed, setSpeedState] = useState<number>(SPEED_DEFAULT);
  const [autoAdvance, setAutoState] = useState(true);

  useEffect(() => {
    const s = window.localStorage.getItem(KEY_SIZE);
    if (s === "normal" || s === "grand" || s === "tres-grand") setSize(s);
    const t = window.localStorage.getItem(KEY_THEME);
    if (t === "ivory" || t === "night") setThemeState(t);
    const v = Number(window.localStorage.getItem(KEY_SPEED));
    if ((SPEEDS as readonly number[]).includes(v)) setSpeedState(v);
    if (window.localStorage.getItem(KEY_AUTO) === "0") setAutoState(false);
  }, []);

  useEffect(() => {
    document.documentElement.dataset["textSize"] = textSize;
    return () => { delete document.documentElement.dataset["textSize"]; };
  }, [textSize]);

  useEffect(() => {
    document.documentElement.classList.toggle("night", theme === "night");
    return () => { document.documentElement.classList.remove("night"); };
  }, [theme]);

  const setTextSize = useCallback((v: TextSize) => { window.localStorage.setItem(KEY_SIZE, v); setSize(v); }, []);
  const setTheme = useCallback((v: Theme) => { window.localStorage.setItem(KEY_THEME, v); setThemeState(v); }, []);
  const setSpeed = useCallback((v: number) => { window.localStorage.setItem(KEY_SPEED, String(v)); setSpeedState(v); }, []);
  const setAutoAdvance = useCallback((v: boolean) => { window.localStorage.setItem(KEY_AUTO, v ? "1" : "0"); setAutoState(v); }, []);

  return (
    <PrefsContext.Provider value={{ textSize, theme, speed, autoAdvance, setTextSize, setTheme, setSpeed, setAutoAdvance }}>
      {children}
    </PrefsContext.Provider>
  );
}

export function usePreferences(): PrefsValue {
  const value = useContext(PrefsContext);
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider");
  return value;
}
