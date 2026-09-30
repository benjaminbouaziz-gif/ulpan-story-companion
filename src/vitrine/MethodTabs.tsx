import { useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import type { VStep } from "@/lib/vitrine.data";
import { ZoomImage } from "./ZoomImage";

/** Les étapes de la méthode : seuls les onglets qui ont une image apparaissent. */
export function MethodTabs({ steps }: { steps: VStep[] }) {
  const { t } = useI18n();
  const shown = steps.filter((s) => s.imageUrl);
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  if (!shown.length) return null;
  const cur = Math.min(active, shown.length - 1);
  const go = (i: number) => {
    const n = (i + shown.length) % shown.length;
    setActive(n);
    refs.current[n]?.focus();
  };
  const step = shown[cur]!;
  return (
    <div>
      <div role="tablist" aria-label={t("vitrine.methodTabs")} className="border-line flex flex-wrap gap-x-5 border-b">
        {shown.map((s, i) => (
          <button
            key={s.stepNo}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            type="button"
            id={`${base}-t${i}`}
            aria-selected={i === cur}
            aria-controls={`${base}-p${i}`}
            tabIndex={i === cur ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") go(i + 1);
              else if (e.key === "ArrowLeft") go(i - 1);
              else if (e.key === "Home") go(0);
              else if (e.key === "End") go(shown.length - 1);
            }}
            className={`label -mb-px border-b-2 py-2 ${i === cur ? "border-current" : "text-secondary-text border-transparent"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-p${cur}`} aria-labelledby={`${base}-t${cur}`} className="mt-4">
        <ZoomImage src={step.imageUrl!} alt={step.label} className="border-line border" gallery={{ items: shown.map((x) => ({ src: x.imageUrl!, alt: x.label, label: x.label })), index: cur, onIndex: setActive }} />
      </div>
    </div>
  );
}
