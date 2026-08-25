import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { usePreferences, type TextSize, type Theme } from "@/lib/preferences";
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

/**
 * Réglage de lecture : feuille qui monte du bas (jamais de fenêtre modale),
 * accessible depuis toute page, mémorisé dans les préférences.
 */
export function ReadingSettings() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { textSize, theme, setTextSize, setTheme } = usePreferences();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="label touch border-line text-foreground flex items-center gap-2 border px-3"
      >
        <span aria-hidden="true" style={{ fontFamily: "var(--font-latin)" }}>
          Aa
        </span>
        {t("reading.settings")}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label={t("nav.close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="bg-background border-line safe-bottom relative border-t px-4 pt-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-hair bg-line" aria-hidden="true" />
            <div className="mx-auto w-full max-w-xl">
              <p className="label text-secondary-text">{t("reading.textSize")}</p>
              <div className="mt-2 flex gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setTextSize(s.value)}
                    aria-pressed={textSize === s.value}
                    className={`label touch border-line flex-1 border px-2 ${
                      textSize === s.value ? "bg-foreground text-background" : ""
                    }`}
                  >
                    {t(s.key)}
                  </button>
                ))}
              </div>

              <p className="label text-secondary-text mt-5">{t("reading.theme")}</p>
              <div className="mt-2 flex gap-2">
                {THEMES.map((th) => (
                  <button
                    key={th.value}
                    type="button"
                    onClick={() => setTheme(th.value)}
                    aria-pressed={theme === th.value}
                    className={`label touch border-line flex-1 border px-2 ${
                      theme === th.value ? "bg-foreground text-background" : ""
                    }`}
                  >
                    {t(th.key)}
                  </button>
                ))}
              </div>

              <div className="border-line mt-5 border-t pt-3">
                <HebrewText>{t("reading.sample")}</HebrewText>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="label touch bg-foreground text-background mt-4 mb-2 w-full"
              >
                {t("nav.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
