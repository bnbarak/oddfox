import type { ReactNode } from "react";
import { ResponsiveContainer, Tooltip } from "recharts";

/** Palette pulled from the CSS custom properties so charts and page agree. */
export const C = {
  hot: "#ff4d3d", warm: "#ffa53d", cool: "#4da3ff", calm: "#3ddc97",
  paper: "#ffffff", fog: "#cacaca", grid: "rgba(255,255,255,.06)",
  axis: "rgba(255,255,255,.16)", void: "#04070a",
};

export const toneColor = (t?: string) =>
  ({ hot: C.hot, warm: C.warm, cool: C.cool, calm: C.calm, paper: C.paper }[t ?? ""] ?? C.paper);

export const PIE_COLORS = [C.hot, C.cool, C.warm, C.calm, "#b48cff", "#8c8c8c", "#5f7d8c", "#d9d9d9"];

export const axisTick = { fill: C.fog, fontFamily: "var(--mono)", fontSize: 10 };
export const gridProps = { stroke: C.grid, strokeWidth: 1 } as const;

/** Dark tooltip that matches the page rather than Recharts' default white box. */
export const OFTooltip = (props: Record<string, unknown>) => (
  <Tooltip
    cursor={{ fill: "rgba(255,255,255,.04)" }}
    contentStyle={{
      background: "#0b1116", border: "1px solid rgba(255,255,255,.16)",
      borderRadius: 3, fontFamily: "var(--mono)", fontSize: 12, color: C.paper,
    }}
    labelStyle={{ color: C.fog, fontSize: 11, letterSpacing: ".05em" }}
    itemStyle={{ color: C.paper }}
    {...props}
  />
);

export const Frame = ({ height, children }: { height: number; children: ReactNode }) => (
  <div style={{ width: "100%", height }}>
    <ResponsiveContainer width="100%" height="100%">
      {children as any}
    </ResponsiveContainer>
  </div>
);
