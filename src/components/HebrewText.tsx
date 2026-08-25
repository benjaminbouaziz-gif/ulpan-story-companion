import type { ReactNode } from "react";

/**
 * Tout texte hébreu passe par ici : dir="rtl", lang="he", Frank Ruhl Libre,
 * sans letter-spacing ni text-transform (les nekoudot se désaligneraient).
 */
export function HebrewText({
  children,
  size = "base",
  className = "",
}: {
  children: ReactNode;
  size?: "base" | "lg";
  className?: string;
}) {
  return (
    <p
      dir="rtl"
      lang="he"
      className={`${size === "lg" ? "hebrew-lg" : "hebrew"} text-right ${className}`}
    >
      {children}
    </p>
  );
}

/** Un mot hébreu à l'intérieur d'une phrase française ou anglaise. */
export function HebrewInline({ children }: { children: ReactNode }) {
  return (
    <span dir="rtl" lang="he" className="hebrew" style={{ fontSize: "1.05em" }}>
      {children}
    </span>
  );
}
