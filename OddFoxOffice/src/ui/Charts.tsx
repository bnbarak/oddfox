import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie as RPie, Cell as RCell,
  XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";
import { lonlat, type Tone } from "./tokens";
import { DB } from "../data";
import { C, toneColor, PIE_COLORS, axisTick, gridProps, OFTooltip, Frame } from "./chartTheme";

export type Pt = { label: string; value: number; tone?: Tone };

/* ---------- columns ---------- */

export function Columns({ points, height = 260, showValues, max, label }: {
  points: Pt[]; height?: number; showValues?: boolean; labelEvery?: number; max?: number; label?: string;
}) {
  return (
    <Frame height={height}>
      <BarChart data={points} margin={{ top: 18, right: 8, bottom: 8, left: 0 }} aria-label={label}>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: C.axis }} tickLine={false}
               interval="preserveStartEnd" angle={points.length > 14 ? -45 : 0}
               textAnchor={points.length > 14 ? "end" : "middle"} height={points.length > 14 ? 56 : 24} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={34}
               domain={max ? [0, max] : [0, "auto"]} />
        <OFTooltip />
        <Bar dataKey="value" isAnimationActive={false} radius={[1, 1, 0, 0]}>
          {points.map((p, i) => <RCell key={i} fill={toneColor(p.tone)} />)}
          {showValues && <LabelList dataKey="value" position="top"
                                    style={{ fill: C.paper, fontFamily: "var(--mono)", fontSize: 11 }} />}
        </Bar>
      </BarChart>
    </Frame>
  );
}

/* ---------- line ---------- */

export function LineChartX({ points, height = 240, label }: {
  points: Pt[]; height?: number; labelEvery?: number; label?: string;
}) {
  return (
    <Frame height={height}>
      <AreaChart data={points} margin={{ top: 14, right: 10, bottom: 8, left: 0 }} aria-label={label}>
        <defs>
          <linearGradient id="ofArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.paper} stopOpacity={0.22} />
            <stop offset="100%" stopColor={C.paper} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: C.axis }} tickLine={false}
               interval="preserveStartEnd" minTickGap={28} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={34} />
        <OFTooltip />
        <Area type="linear" dataKey="value" stroke={C.paper} strokeWidth={2}
              fill="url(#ofArea)" isAnimationActive={false}
              dot={{ r: 3, fill: C.void, stroke: C.paper, strokeWidth: 2 }} />
      </AreaChart>
    </Frame>
  );
}
export { LineChartX as LineChart };

/* ---------- pie / donut ---------- */

export type Slice = { label: string; value: number; tone?: string };

export function Pie({ items, donut = true, centreLabel = "TOTAL", height = 200, label }: {
  items: Slice[]; donut?: boolean; centreLabel?: string; height?: number; label?: string;
}) {
  const list = items.filter((i) => i.value > 0);
  const total = list.reduce((a, i) => a + i.value, 0);
  if (!total) return <p className="of-note">No data.</p>;
  const colorOf = (it: Slice, i: number) => it.tone ?? PIE_COLORS[i % PIE_COLORS.length];
  return (
    <div>
      <div style={{ position: "relative", width: "100%", height }}>
        <Frame height={height}>
          <PieChart aria-label={label}>
            <RPie data={list} dataKey="value" nameKey="label" cx="50%" cy="50%"
                  innerRadius={donut ? "46%" : 0} outerRadius="80%" isAnimationActive={false}
                  stroke={C.void} strokeWidth={1.5} paddingAngle={0}>
              {list.map((it, i) => <RCell key={it.label} fill={colorOf(it, i)} fillOpacity={0.85} />)}
            </RPie>
            <OFTooltip formatter={(v: number, n: string) => [`${v} (${Math.round((v / total) * 100)}%)`, n]} />
          </PieChart>
        </Frame>
        {donut && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", pointerEvents: "none",
          }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 26, color: C.paper, fontVariantNumeric: "tabular-nums" }}>{total}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: 1.5, color: C.fog }}>{centreLabel}</div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 14 }}>
        {list.map((it, i) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--paper)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: colorOf(it, i), flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{it.label}</span>
            <span className="of-num" style={{ opacity: .8 }}>{it.value}</span>
            <span className="of-num" style={{ color: "var(--fog)", minWidth: 34, textAlign: "right" }}>
              {Math.round((it.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- world map ----------
   Not a chart. A projection with proportional circles, so it stays hand-drawn:
   no charting library models geography.                                        */

export type MapPoint = {
  name: string; coords: [number, number]; count?: number | null; unquantified?: string | null;
};

export function WorldMap({ points, reference, world, heat, maxRef, label }: {
  points: MapPoint[]; reference?: MapPoint[]; world?: boolean; heat?: boolean;
  maxRef?: number; label?: string;
}) {
  const counted = points.filter((p) => p.count);
  const maxC = maxRef ?? Math.max(...counted.map((p) => p.count as number), 1);
  const xs: number[] = [], ys: number[] = [];
  points.forEach((p) => { const c = lonlat(p.coords[0], p.coords[1]); xs.push(c[0]); ys.push(c[1]); });

  let view: [number, number, number, number] = [0, 0, 2000, 1000];
  if (!world && xs.length) {
    const padX = 190, padY = 140;
    let x0 = Math.max(0, Math.min(...xs) - padX);
    const x1 = Math.min(2000, Math.max(...xs) + padX);
    let y0 = Math.max(0, Math.min(...ys) - padY);
    const y1 = Math.min(1000, Math.max(...ys) + padY);
    let w = Math.max(x1 - x0, 460), h = Math.max(y1 - y0, 260);
    if (w / h < 1.6) { const need = h * 1.6; x0 -= (need - w) / 2; w = need; }
    if (w / h > 2.8) { const needH = w / 2.8; y0 -= (needH - h) / 2; h = needH; }
    x0 = Math.max(0, Math.min(x0, 2000 - w));
    y0 = Math.max(0, Math.min(y0, 1000 - h));
    view = [x0, y0, Math.min(w, 2000), Math.min(h, 1000)];
  }
  const k = view[2] / 2000;
  const refs = (reference ?? []).filter((r) => {
    const c = lonlat(r.coords[0], r.coords[1]);
    return c[0] >= view[0] && c[0] <= view[0] + view[2] && c[1] >= view[1] && c[1] <= view[1] + view[3];
  });
  const placed: { x: number; y: number; w: number }[] = [];
  const ordered = [...points].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  return (
    <>
      <svg className="of-map" viewBox={view.map((v) => v.toFixed(1)).join(" ")}
           role="img" aria-label={label ?? "Incident map"} preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: 13 }, (_, i) => -180 + i * 30).map((lon) => {
          const gx = lonlat(0, lon)[0];
          return <line key={`v${lon}`} className="grat" x1={gx} y1={0} x2={gx} y2={1000} />;
        })}
        {Array.from({ length: 5 }, (_, i) => -60 + i * 30).map((lat) => {
          const gy = lonlat(lat, 0)[1];
          return <line key={`h${lat}`} className="grat" x1={0} y1={gy} x2={2000} y2={gy} />;
        })}
        {(DB.worldLand.paths as string[]).map((d, i) => <path key={i} className="land" d={d} />)}
        {refs.map((r) => {
          const c = lonlat(r.coords[0], r.coords[1]); const m = 7 * k;
          return (
            <g key={r.name}>
              <title>{r.name}</title>
              <path className="ref" d={`M${(c[0]-m).toFixed(1)},${c[1].toFixed(1)}h${(m*2).toFixed(1)}M${c[0].toFixed(1)},${(c[1]-m).toFixed(1)}v${(m*2).toFixed(1)}`} />
              <text className="ref-l" style={{ fontSize: `${11 * k}px` }} x={c[0]+m+3} y={c[1]+3*k}>{r.name}</text>
            </g>
          );
        })}
        {ordered.map((p, i) => {
          const c = lonlat(p.coords[0], p.coords[1]);
          const n = p.count;
          const r = (heat ? 3 + Math.sqrt((n ?? 0) / maxC) * 26 : n ? 9 + Math.sqrt(n / maxC) * 46 : 7) * k;
          const cls = n ? "pt" : p.unquantified ? "pt unq" : "pt zero";
          /* Try slots around the circle — below, above, then stepped out, then to
             the side — so dense clusters (Red Sea, Singapore) do not stack. */
          const w = (p.name.length * 6.6 + 10) * k;   // approx label width
          const slots: [number, number, "middle" | "start" | "end"][] = [
            [0, r + 14 * k, "middle"], [0, -(r + 6 * k), "middle"],
            [0, r + 30 * k, "middle"], [0, -(r + 22 * k), "middle"],
            [r + 8 * k, 4 * k, "start"], [-(r + 8 * k), 4 * k, "end"],
            [r + 8 * k, r + 18 * k, "start"], [-(r + 8 * k), r + 18 * k, "end"],
            [r + 8 * k, -(r + 10 * k), "start"], [-(r + 8 * k), -(r + 10 * k), "end"],
            [0, r + 46 * k, "middle"], [0, -(r + 38 * k), "middle"],
          ];
          let [ox, oy, anchor] = slots[0];
          for (const [sx, sy, a] of slots) {
            const lx = c[0] + sx + (a === "start" ? w / 2 : a === "end" ? -w / 2 : 0);
            if (!placed.some((q) => Math.abs(q.x - lx) < (q.w + w) / 2 && Math.abs(q.y - (c[1] + sy)) < 13 * k)) {
              ox = sx; oy = sy; anchor = a; break;
            }
          }
          const labelX = c[0] + ox + (anchor === "start" ? w / 2 : anchor === "end" ? -w / 2 : 0);
          placed.push({ x: labelX, y: c[1] + oy, w });
          const showName = !heat && (n || p.unquantified || placed.length <= 12);
          return (
            <g key={`${p.name}-${i}`}>
              <title>{p.name} — {n != null ? n : (p.unquantified ?? "none")}</title>
              <circle className={cls} cx={c[0].toFixed(1)} cy={c[1].toFixed(1)} r={r.toFixed(1)} />
              {n != null && !heat && (
                <text className="ct" style={{ fontSize: `${15 * k}px` }} x={c[0].toFixed(1)} y={(c[1]+5*k).toFixed(1)} textAnchor="middle">{n}</text>
              )}
              {showName && (
                <text style={{ fontSize: `${13 * k}px` }} x={(c[0]+ox).toFixed(1)}
                      y={(c[1]+oy).toFixed(1)} textAnchor={anchor}>{p.name}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="of-maplegend">
        <span className="k">
          <span className="sw" style={{ background: "rgba(255,77,61,.55)", border: "1px solid var(--hot)" }} />
          {heat ? "attacks per 2° cell, area proportional to count" : "incidents, area proportional to count"}
        </span>
        {!heat && <>
          <span className="k"><span className="sw" style={{ border: "1px dashed var(--warm)" }} />reported, not quantified</span>
          <span className="k"><span className="sw" style={{ border: "1px dashed var(--fog)" }} />zero</span>
        </>}
        {refs.length > 0 && <span className="k"><span className="sw" style={{ border: "1px solid var(--cool)" }} />chokepoint</span>}
      </div>
    </>
  );
}
