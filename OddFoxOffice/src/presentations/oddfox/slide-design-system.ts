// Shared style constants for the Seaworth deck. Nothing here is imported by the
// framework; it exists so slides stay visually consistent without a component
// library.
export const TONE = {
  hot: "var(--hot)",
  warm: "var(--warm)",
  cool: "var(--cool)",
  calm: "var(--calm)",
  paper: "var(--color-fg)",
} as const;

export const card: React.CSSProperties = {
  padding: "1.75rem 1.5rem",
  border: "1px solid var(--color-border)",
  borderRadius: "3px",
  background: "var(--color-bg-elevated)",
  height: "100%",
};

export const statValue: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "clamp(2rem, 4.5vw, 3.4rem)",
  fontWeight: 400,
  letterSpacing: "-0.04em",
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
};

export const statLabel: React.CSSProperties = {
  color: "var(--color-fg)",
  lineHeight: 1.4,
  fontSize: "1rem",
  marginTop: "0.75rem",
};

export const statSub: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-fg-muted)",
  marginTop: "0.5rem",
};

export const source: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.68rem",
  letterSpacing: "0.04em",
  color: "var(--color-fg-muted)",
  marginTop: "2rem",
};
