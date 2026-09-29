import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { SPEEDS, usePreferences, type TextSize, type Theme } from "@/lib/preferences";
import { HebrewText } from "./HebrewText";

const SIZES: { value: TextSize; key: "reading.size.normal" | "reading.size.grand" | "reading.size.tresGrand" }[] = [
  { value: "normal", key: "reading.size.normal" },
  { value: "grand", key: "reading.size.grand" },
  { value: "tres-grand", key: "reading.size.tresGrand" },
];

const THEMES: { value: Theme; key: "reading.theme.ivory" | "reading.theme.night" }[] = [
  { value: "ivory", key: "reading.theme.ivory" },
  { value: "night", key: "reading.theme.night" },
];

/** Réglages de lecture (bouton « Aa ») : feuille qui monte du bas, dans le compagnon seulement. */
export function ReadingSettings() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { textSize, theme, speed, setTextSize, setTheme, setSpeed } = usePreferences();
  const choice = (on: boolean) => `label touch border-line flex-1 border px-2 ${on ? "bg-foreground text-background" : ""}`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-label={t("reading.settings")}
        className="label touch border-line text-foreground flex items-center gap-2 border px-3">
        <span aria-hidden="true" style={{ fontFamily: "var(--font-latin)", textTransform: "none" }}>Aa</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button type="button" aria-label={t("nav.close")} onClick={() => setOpen(false)} className="bg-foreground/40 absolute inset-0" />
          <div className="bg-background border-line safe-bottom relative border-t px-4 pt-3">
            <div className="bg-line mx-auto mb-3 h-1 w-10" aria-hidden="true" />
            <div className="mx-auto w-full max-w-xl">
              <p className="label text-secondary-text">{t("reading.textSize")}</p>
              <div className="mt-2 flex gap-2">
                {SIZES.map((s) => (
                  <button key={s.value} type="button" onClick={() => setTextSize(s.value)} aria-pressed={textSize === s.value} className={choice(textSize === s.value)}>{t(s.key)}</button>
                ))}
              </div>

              <p className="label text-secondary-text mt-5">{t("reading.theme")}</p>
              <div className="mt-2 flex gap-2">
                {THEMES.map((th) => (
                  <button key={th.value} type="button" onClick={() => setTheme(th.value)} aria-pressed={theme === th.value} className={choice(theme === th.value)}>{t(th.key)}</button>
                ))}
              </div>

              <p className="label text-secondary-text mt-5">{t("reading.defaultSpeed")}</p>
              <div className="mt-2 flex gap-2">
                {SPEEDS.map((v) => (
                  <button key={v} type="button" onClick={() => setSpeed(v)} aria-pressed={speed === v} className={choice(speed === v)}>
                    <span className="tabular-nums">{String(v).replace(".", ",")}</span>
                  </button>
                ))}
              </div>

              <div className="border-line mt-5 border-t pt-3">
                <HebrewText>{t("reading.sample")}</HebrewText>
              </div>

              <button type="button" onClick={() => setOpen(false)} className="label touch bg-foreground text-background mt-4 mb-2 w-full">{t("nav.close")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
