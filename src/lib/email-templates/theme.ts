// Identité visuelle d'Ulpan Story, transposée dans le courrier : ivoire, encre,
// serif. Le fond du Body reste blanc, comme l'exigent les clients de messagerie.
export const brand = {
  ink: "#15171a",
  muted: "#6c6c66",
  rule: "#d7d5ce",
  ivory: "#f3f1ea",
  accent: "#16407a",
};

export const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Georgia, 'Times New Roman', serif",
  margin: 0,
  padding: "24px 0",
};

export const container = {
  backgroundColor: brand.ivory,
  border: `1px solid ${brand.rule}`,
  padding: "32px 28px",
  maxWidth: "520px",
};

export const wordmark = {
  fontSize: "11px",
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: brand.muted,
  margin: "0 0 24px",
};

export const h1 = {
  fontSize: "24px",
  fontWeight: "normal" as const,
  color: brand.ink,
  lineHeight: "1.2",
  margin: "0 0 20px",
};

export const text = {
  fontSize: "16px",
  color: brand.ink,
  lineHeight: "1.55",
  margin: "0 0 20px",
};

export const link = { color: brand.accent, textDecoration: "underline" };

export const button = {
  backgroundColor: brand.ink,
  color: brand.ivory,
  fontSize: "12px",
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  padding: "14px 22px",
  textDecoration: "none",
  display: "inline-block",
};

export const code = {
  fontFamily: "Courier, monospace",
  fontSize: "28px",
  letterSpacing: "0.2em",
  color: brand.ink,
  margin: "0 0 24px",
};

export const footer = {
  fontSize: "12px",
  color: brand.muted,
  lineHeight: "1.5",
  borderTop: `1px solid ${brand.rule}`,
  paddingTop: "16px",
  margin: "28px 0 0",
};
