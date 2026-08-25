/**
 * Le logo : la lettre ל composée en Frank Ruhl Libre.
 * Jamais dans un cercle, jamais déformée.
 */
export function Lamed({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`hebrew inline-block leading-none select-none ${className}`}
      style={{ fontSize: "inherit" }}
    >
      ל
    </span>
  );
}
