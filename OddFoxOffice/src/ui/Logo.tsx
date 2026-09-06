import { useState } from "react";

const host = (url?: string | null) => {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
};

const initials = (name: string) =>
  name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

/** Company mark. Falls back to a monogram when the site publishes no icon. */
export function Logo({ url, name, size = 20 }: { url?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const h = host(url);
  const box = { width: size, height: size, minWidth: size } as const;

  if (!h || failed) {
    return <span className="of-logo of-logo--mono" style={box} aria-hidden="true">{initials(name)}</span>;
  }
  return (
    <img className="of-logo" style={box} loading="lazy" decoding="async"
         src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`}
         alt="" aria-hidden="true" onError={() => setFailed(true)} />
  );
}
