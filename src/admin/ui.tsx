import type { ReactNode } from "react";

/** Briques visuelles sobres de l'admin (charte du site). */
export const inputCls = "border-line bg-background block w-full border px-2 py-1 text-[14px]";
export const btnCls = "border-line border px-3 py-1 text-[13px] disabled:opacity-40";
export const btnPrimaryCls = "bg-foreground text-background px-3 py-1 text-[13px] disabled:opacity-40";
export const cellCls = "border-line border-b px-2 py-1 text-left align-middle";
export const hebrewStyle = {
  fontFamily: "var(--font-hebrew)",
  letterSpacing: "normal",
  fontSize: "18px",
  lineHeight: 1.9,
} as const;

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label text-secondary-text">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-line mt-8 border-t pt-4">
      <h2 className="label">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function EditionPastilles({ editions }: { editions: { lang: string; status: string }[] }) {
  return (
    <span className="flex flex-wrap gap-2">
      {(["fr", "en"] as const).map((l) => {
        const e = editions.find((x) => x.lang === l);
        return (
          <span key={l} className="border-line border px-2 py-[1px] text-[12px]">
            {l.toUpperCase()} · {e ? (e.status === "publiee" ? "publiée" : "en préparation") : "—"}
          </span>
        );
      })}
    </span>
  );
}

export function Prochainement() {
  return <p className="text-secondary-text">Arrive dans une prochaine phase.</p>;
}
