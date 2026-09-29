import { useState, type ReactNode } from "react";

type Lang = "fr" | "en";
const LABELS: Record<Lang, string> = { fr: "Français · oulpanstory.fr", en: "English · ulpanstory.com" };

/** Les deux onglets de langue de chaque écran du site. */
export function LangTabs({ children }: { children: (lang: Lang) => ReactNode }) {
  const [lang, setLang] = useState<Lang>("fr");
  return (
    <div>
      <nav className="border-line mt-4 flex gap-5 border-b">
        {(["fr", "en"] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} className={`label border-b-2 py-2 ${lang === l ? "border-current" : "border-transparent"}`}>
            {LABELS[l]}
          </button>
        ))}
      </nav>
      <div key={lang} className="mt-4">{children(lang)}</div>
    </div>
  );
}
