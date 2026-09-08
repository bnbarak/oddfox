import type { ReactNode, CSSProperties } from "react";
import { TONE_VAR, CONF_TONE, type Tone } from "./tokens";
import { source } from "../data";

export const Section = ({ kicker, children }: { kicker: string; children: ReactNode }) => (
  <section className="of-section">
    <div className="of-kicker">{kicker}</div>
    {children}
  </section>
);

export const Grid = ({ cols = 3, children, style }: { cols?: 2 | 3 | 4; children: ReactNode; style?: CSSProperties }) => (
  <div className={`of-grid cols-${cols}`} style={style}>{children}</div>
);

export const Cell = ({ children }: { children: ReactNode }) => <div className="of-cell">{children}</div>;

export const Card = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="of-card" style={style}>{children}</div>
);

export const Note = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <p className="of-note" style={style}>{children}</p>
);

export const Callout = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="of-callout" style={style}>{children}</div>
);

export const Gap = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="of-gap" style={style}>{children}</div>
);

export const Kicker = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="of-kicker" style={style}>{children}</div>
);

export const H1 = ({ children }: { children: ReactNode }) => <h1 className="of-h1">{children}</h1>;
export const H2 = ({ children }: { children: ReactNode }) => <div className="of-h2">{children}</div>;
export const H3 = ({ children }: { children: ReactNode }) => <div className="of-h3">{children}</div>;
export const Lede = ({ children }: { children: ReactNode }) => <p className="of-lede">{children}</p>;

export const Src = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="of-src" style={style}>{children}</div>
);

export const Chip = ({ children, tone = "" }: { children: ReactNode; tone?: Tone | "solid" }) => (
  <span className={`of-chip ${tone}`}>{children}</span>
);

export const Chips = ({ items, tone = "" }: { items: (string | undefined)[]; tone?: Tone }) => (
  <div className="of-chips">
    {items.filter(Boolean).map((t, i) => <Chip key={`${t}-${i}`} tone={tone}>{t}</Chip>)}
  </div>
);

export const ConfChip = ({ level }: { level?: string }) =>
  level ? <Chip tone={CONF_TONE[level] ?? ""}>{level} confidence</Chip> : null;

export const Flag = ({ iso, name, size = 24, large }: {
  iso?: string | null; name?: string; size?: number; large?: boolean;
}) =>
  iso ? (
    <img className={`of-flag${large ? " lg" : ""}`} loading="lazy"
         src={`https://flagsapi.com/${iso.toUpperCase()}/flat/${size}.png`}
         alt={name ?? iso} title={name ?? iso} />
  ) : (
    <span className="of-flag-none" title="flag not recorded" />
  );

export const Stat = ({ value, label, sub, delta }: {
  value: ReactNode; label: ReactNode; sub?: ReactNode; delta?: number | null;
}) => (
  <div className="of-stat">
    <div className="of-stat-v">
      {value}
      {delta != null && (
        <span className={`of-delta ${delta > 0 ? "up" : "down"}`}>
          {" "}{delta > 0 ? "+" : ""}{delta}%
        </span>
      )}
    </div>
    <div className="of-stat-l">{label}</div>
    {sub ? <div className="of-stat-s">{sub}</div> : null}
  </div>
);

export const Cite = ({ ids }: { ids?: (string | undefined)[] }) => {
  const list = (ids ?? []).filter(Boolean) as string[];
  if (!list.length) return null;
  return (
    <div className="of-src">
      Source:{" "}
      {list.map((id, i) => {
        const s = source(id);
        return (
          <span key={id}>
            {i > 0 && " · "}
            {s ? <a className="of-link" href={s.url} target="_blank" rel="noopener">{s.publisher ?? s.name}</a> : id}
          </span>
        );
      })}
    </div>
  );
};

export type BarRow = { label: ReactNode; value: number; tone?: Tone };

export const Bars = ({ rows, suffix = "", max }: { rows: BarRow[]; suffix?: string; max?: number }) => {
  const m = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="of-bars">
      {rows.map((r, i) => (
        <div className="of-bar-row" key={i}>
          <div className="of-bar-lab">{r.label}</div>
          <div className="of-bar-track">
            <div className="of-bar-fill"
                 style={{ width: `${(r.value / m) * 100}%`, background: TONE_VAR[r.tone ?? ""] }} />
          </div>
          <div className="of-bar-v">{r.value}{suffix}</div>
        </div>
      ))}
    </div>
  );
};

export type Col<T> = { key: string; label: string; num?: boolean; render?: (row: T) => ReactNode };

export function Table<T extends Record<string, any>>({ rows, cols }: { rows: T[]; cols: Col<T>[] }) {
  return (
    <div className="of-scroll">
      <table className="of-table">
        <thead>
          <tr>{cols.map((c) => <th key={c.key} style={c.num ? { textAlign: "right" } : undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c.key} className={c.num ? "num" : undefined}>
                  {c.render ? c.render(row) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Two columns: a sticky left rail for the picker, the reading matter on the right. */
export const Split = ({ side, children }: { side: ReactNode; children: ReactNode }) => (
  <div className="of-split">
    <aside className="of-split-side">{side}</aside>
    <div className="of-split-main">{children}</div>
  </div>
);

export function Toggle<T extends string>({ options, value, onChange, vertical }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; vertical?: boolean;
}) {
  return (
    <div className={vertical ? "of-toggle of-toggle-v" : "of-toggle"}>
      {options.map((o) => (
        <button key={o.id} className="of-opt" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Sub = ({ children }: { children: ReactNode }) => <span className="sub">{children}</span>;

/** Marks a direct competitor. Title text carries the meaning for screen readers. */
export const Star = ({ on = true, title = "Direct competitor" }: { on?: boolean; title?: string }) =>
  on ? <span className="of-star" title={title} aria-label={title}>★</span> : null;

/** External link. Always shows where it goes rather than hiding it behind a word. */
export function Site({ url, label, bare }: { url?: string | null; label?: string; bare?: boolean }) {
  if (!url) return <span className="of-dot-off" title="no link on record" />;
  const host = url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  return (
    <a className="of-link of-site" href={url} target="_blank" rel="noopener noreferrer" title={url}>
      {label ?? (bare ? host : host)}
    </a>
  );
}
