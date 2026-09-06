import { useState, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import type { Tone } from "./tokens";
import { C, toneColor, axisTick, gridProps, OFTooltip, Frame } from "./chartTheme";

/* ---------- multi-series time chart ---------- */

export type MultiPoint = { date: string; low: number; high: number; label: string; approx?: boolean };
export type MultiSeries = { area: string; tone?: Tone; points: MultiPoint[] };

export function MultiLine({ series, height = 340, logY = true, label }: {
  series: MultiSeries[]; height?: number; logY?: boolean; label?: string;
}) {
  // Recharts wants one row per x value with a column per series.
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const data = dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    series.forEach((s) => {
      const p = s.points.find((q) => q.date === date);
      row[s.area] = p ? (p.low + p.high) / 2 : null;
    });
    return row;
  });
  const all = series.flatMap((s) => s.points.map((p) => (p.low + p.high) / 2));
  const domain: [number, number] = [Math.max(Math.min(...all) * 0.6, 0.05), Math.max(...all) * 1.5];

  return (
    <>
      <Frame height={height}>
        <LineChart data={data} margin={{ top: 16, right: 60, bottom: 8, left: 0 }} aria-label={label}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" tick={axisTick} axisLine={{ stroke: C.axis }} tickLine={false} minTickGap={40} />
          <YAxis scale={logY ? "log" : "linear"} domain={domain} tick={axisTick} width={46}
                 axisLine={false} tickLine={false} allowDataOverflow
                 ticks={logY ? [0.1, 0.25, 0.5, 1, 2.5, 5, 10] : undefined}
                 tickFormatter={(v: number) => `${v}%`} />
          <OFTooltip formatter={(v: number) => `${v}%`} />
          <Legend wrapperStyle={{ fontFamily: "var(--mono)", fontSize: 11, color: C.paper }} />
          {series.map((s) => (
            <Line key={s.area} type="linear" dataKey={s.area} stroke={toneColor(s.tone)}
                  strokeWidth={2.5} connectNulls isAnimationActive={false}
                  dot={{ r: 4, fill: C.void, stroke: toneColor(s.tone), strokeWidth: 2.5 }} />
          ))}
        </LineChart>
      </Frame>
      {logY && (
        <p className="of-note" style={{ marginTop: 10 }}>
          Vertical axis is logarithmic; the plotted range spans 0.1% to 10% of hull value. Points the
          source described in relative terms sit on an approximate date.
        </p>
      )}
    </>
  );
}

/* ---------- slope ---------- */

export type SlopeRow = { label: string; from: number; to: number; body?: string; tone?: Tone };

export function Slope({ rows, height = 320, fromLabel = "FROM", toLabel = "TO", label }: {
  rows: SlopeRow[]; height?: number; fromLabel?: string; toLabel?: string; label?: string;
}) {
  const data = [
    { step: fromLabel, ...Object.fromEntries(rows.map((r) => [r.label, r.from])) },
    { step: toLabel, ...Object.fromEntries(rows.map((r) => [r.label, r.to])) },
  ];
  return (
    <>
      <Frame height={height}>
        <LineChart data={data} margin={{ top: 26, right: 120, bottom: 12, left: 12 }} aria-label={label}>
          <CartesianGrid {...gridProps} horizontal={false} />
          <XAxis dataKey="step" tick={{ ...axisTick, fontSize: 11, letterSpacing: 1 }}
                 axisLine={false} tickLine={false} padding={{ left: 60, right: 60 }} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} />
          <OFTooltip />
          {rows.map((r) => {
            const col = r.tone ? toneColor(r.tone) : r.to < r.from ? C.calm : C.hot;
            const pct = r.from ? Math.round(((r.to - r.from) / r.from) * 100) : null;
            return (
              <Line key={r.label} dataKey={r.label} stroke={col} strokeWidth={2.5}
                    isAnimationActive={false}
                    dot={{ r: 5, fill: C.void, stroke: col, strokeWidth: 2.5 }}
                    label={({ x, y, index }: any) =>
                      index === 1 ? (
                        <text x={x + 12} y={y + 4} fill={col} fontFamily="var(--mono)" fontSize={13}>
                          {r.to}{pct != null ? `  ${pct > 0 ? "+" : ""}${pct}%` : ""}
                        </text>
                      ) : <g />}
              />
            );
          })}
        </LineChart>
      </Frame>
      <div className="of-maplegend">
        {rows.map((r) => (
          <span className="k" key={r.label}>
            <span className="sw" style={{ width: 16, height: 3, borderRadius: 0,
              background: r.tone ? toneColor(r.tone) : r.to < r.from ? C.calm : C.hot }} />
            {r.label}{r.body ? ` · ${r.body}` : ""}
          </span>
        ))}
      </div>
    </>
  );
}

/* ---------- stacked area ---------- */

export type StackSeries = { label: string; tone?: Tone; values: number[] };

export function StackedArea({ xLabels, series, height = 340, label }: {
  xLabels: string[]; series: StackSeries[]; height?: number; label?: string;
}) {
  const data = xLabels.map((x, i) => {
    const row: Record<string, string | number> = { x };
    series.forEach((s) => { row[s.label] = s.values[i] ?? 0; });
    return row;
  });
  return (
    <>
      <Frame height={height}>
        <AreaChart data={data} margin={{ top: 18, right: 12, bottom: 8, left: 0 }} aria-label={label}>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="x" tick={{ ...axisTick, fontSize: 11 }} axisLine={{ stroke: C.axis }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} />
          <OFTooltip />
          <Legend wrapperStyle={{ fontFamily: "var(--mono)", fontSize: 11 }} />
          {series.map((s) => (
            <Area key={s.label} type="linear" dataKey={s.label} stackId="1"
                  stroke={toneColor(s.tone)} strokeWidth={1.5}
                  fill={toneColor(s.tone)} fillOpacity={0.38} isAnimationActive={false} />
          ))}
        </AreaChart>
      </Frame>
    </>
  );
}

/* ---------- matrix ----------
   A table, not a chart. Stays hand-built.                                     */

export type MatrixCell = { on?: boolean; tone?: Tone; text?: string; num?: boolean; title?: string } | null;
import { Logo } from "./Logo";

export type MatrixCol = {
  label: string;
  title?: string;
  /** Values this column can be filtered to. Omit for a sort-only column. */
  options?: { id: string; label: string; n: number }[];
  selected?: string[];
  sortable?: boolean;
  on?: boolean;
};

export type MatrixRow = { label: string; sub?: string; cells: MatrixCell[];
                          star?: boolean; url?: string | null };

/** Header-driven table: each column carries its own sort and filter menu, so the
    controls sit where the data is rather than in a block above it. */
export function Matrix({ rows, cols, corner = "Company", sort, onSort, onFilter, onClear }: {
  rows: MatrixRow[]; cols: MatrixCol[]; corner?: string;
  sort?: { col: number; dir: "asc" | "desc" } | null;
  onSort?: (col: number, dir: "asc" | "desc") => void;
  onFilter?: (col: number, optionId: string) => void;
  onClear?: (col: number) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const timer = useRef<number | undefined>(undefined);

  const show = (i: number, el: HTMLElement) => {
    window.clearTimeout(timer.current);
    const r = el.getBoundingClientRect();
    setPos({ x: Math.min(r.left, window.innerWidth - 260), y: r.bottom });
    setOpen(i);
  };
  const hide = () => { timer.current = window.setTimeout(() => setOpen(null), 160); };
  const keep = () => window.clearTimeout(timer.current);

  const menu = open == null ? null : cols[open];
  const arrow = (i: number) => (sort?.col === i ? (sort.dir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="of-matrix-wrap">
      <table className="of-matrix">
        <thead>
          <tr>
            <th className="co sel" onMouseEnter={(e) => show(-1, e.currentTarget)} onMouseLeave={hide}>
              {corner}{sort?.col === -1 ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
            </th>
            {cols.map((c, i) => (
              <th key={c.label} title={c.title ?? c.label}
                  className={`${c.options || c.sortable ? "sel" : ""}${(c.selected?.length || c.on) ? " is-on" : ""}`}
                  onMouseEnter={(e) => show(i, e.currentTarget)} onMouseLeave={hide}>
                {c.label}{arrow(i)}{c.selected?.length ? " ●" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="co">
                {r.url ? (
                  <a className="co-row" href={r.url} target="_blank" rel="noopener noreferrer"
                     title={[r.label, r.sub, r.url].filter(Boolean).join(" — ")}>
                    {r.star && <span className="of-star" title="Autonomous competitor">★</span>}
                    <Logo url={r.url} name={r.label} />
                    <span className="co-name">{r.label}</span>
                  </a>
                ) : (
                  <span className="co-row" title={[r.label, r.sub].filter(Boolean).join(" — ")}>
                    {r.star && <span className="of-star" title="Autonomous competitor">★</span>}
                    <Logo url={null} name={r.label} />
                    <span className="co-name">{r.label}</span>
                  </span>
                )}
              </td>
              {r.cells.map((c, j) => {
                if (c == null) return <td key={j} className="cell"><span className="of-dot-off" /></td>;
                if (c.text != null)
                  return <td key={j} className={c.num ? "val" : "cell"}>
                    {c.text === "" ? <span className="of-dot-off" /> : c.text}
                  </td>;
                return <td key={j} className="cell">
                  {c.on ? <span className={`of-dot ${c.tone ?? ""}`} title={c.title} /> : <span className="of-dot-off" />}
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {open != null && (
        <div className="of-hdrmenu" style={{ left: pos.x, top: pos.y }}
             onMouseEnter={keep} onMouseLeave={hide}>
          <div className="of-hdrmenu__t">{open === -1 ? corner : menu?.label}</div>
          <button className="of-hdrmenu__b" onClick={() => onSort?.(open, "asc")}>Sort ascending</button>
          <button className="of-hdrmenu__b" onClick={() => onSort?.(open, "desc")}>Sort descending</button>
          {menu?.options?.length ? (
            <>
              <div className="of-hdrmenu__sep" />
              <div className="of-hdrmenu__opts">
                {menu.options.map((o) => {
                  const on = menu.selected?.includes(o.id);
                  return (
                    <button key={o.id} className={`of-hdrmenu__o${on ? " is-on" : ""}`}
                            disabled={!on && o.n === 0}
                            onClick={() => onFilter?.(open, o.id)}>
                      <span className="of-hdrmenu__box">{on ? "✓" : ""}</span>
                      {o.label}<span className="of-facet__n">{o.n}</span>
                    </button>
                  );
                })}
              </div>
              {menu.selected?.length ? (
                <button className="of-hdrmenu__b of-hdrmenu__clear" onClick={() => onClear?.(open)}>
                  Clear this column
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
