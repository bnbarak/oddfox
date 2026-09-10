import { TONE } from "../oddfox/slide-design-system";

/* The club and the Pool in one figure, shared by both decks so there is one
   picture of this rather than two that drift apart.

   Left: a club is not a company its members buy from — the members ARE it.
   Drawing the ships ON the ring, rather than outside it pointing in, is the
   whole point of the picture.

   Right: what happens as one claim grows. The steps are equal width and the
   thresholds are labelled, because the real range ($10m to $8.9bn) cannot be
   drawn to scale without the first four steps vanishing. */

const MEMBERS = 8;
const CX = 190;
const CY = 168;
const R = 108;

const STEPS = [
  { from: "$0", to: "$10m", who: "Your club alone", t: TONE.calm },
  { from: "$10m", to: "$100m", who: "The Pool — all twelve", t: TONE.cool },
  { from: "$100m", to: "$2.35bn", who: "Reinsurance market", t: TONE.warm },
  { from: "$2.35bn", to: "$3.35bn", who: "Collective overspill", t: TONE.warm },
  { from: "$3.35bn", to: "~$8.9bn", who: "Called from members", t: TONE.hot },
];

export function ClubDiagram() {
  const stepW = 118;
  const x0 = 470;
  const barY = 150;
  const barH = 58;

  return (
    <svg viewBox="0 0 1180 340" style={{ width: "100%", height: "auto", marginTop: "0.5rem" }}
         role="img" aria-label="Left: eight shipowners forming the ring of a club, paying calls in and receiving claims out. Right: a five step ladder showing who pays as one claim grows, from the club alone up to a call on members.">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-border)" strokeWidth={2} />
      {Array.from({ length: MEMBERS }).map((_, i) => {
        const a = (i / MEMBERS) * Math.PI * 2 - Math.PI / 2;
        const x = CX + R * Math.cos(a);
        const y = CY + R * Math.sin(a);
        return (
          <g key={i}>
            <rect x={x - 17} y={y - 9} width={34} height={18} rx={3}
                  fill="var(--color-bg-elevated)" stroke={TONE.cool} strokeWidth={1.5} />
            <path d={`M ${x - 13} ${y + 3} L ${x + 13} ${y + 3} L ${x + 9} ${y + 7} L ${x - 9} ${y + 7} Z`}
                  fill={TONE.cool} opacity={0.7} />
          </g>
        );
      })}
      <text x={CX} y={CY - 6} textAnchor="middle" fill="var(--color-fg)"
            style={{ font: "500 20px var(--font-sans, system-ui)" }}>THE CLUB</text>
      <text x={CX} y={CY + 16} textAnchor="middle" fill="var(--color-fg-muted)"
            style={{ font: "13px var(--font-mono, monospace)" }}>is these ships</text>
      <text x={CX} y={CY + 152} textAnchor="middle" fill="var(--color-fg-muted)"
            style={{ font: "13px var(--font-mono, monospace)" }}>
        calls in · claims out · no shareholders
      </text>

      <path d={`M ${CX + R + 24} ${CY} L ${x0 - 26} ${CY}`} stroke="var(--color-border)"
            strokeWidth={1.5} strokeDasharray="4 4" />
      <path d={`M ${x0 - 32} ${CY - 6} L ${x0 - 22} ${CY} L ${x0 - 32} ${CY + 6}`}
            fill="none" stroke="var(--color-border)" strokeWidth={1.5} />
      <text x={(CX + R + x0) / 2} y={CY - 14} textAnchor="middle" fill="var(--color-fg-muted)"
            style={{ font: "12px var(--font-mono, monospace)" }}>one claim</text>

      {STEPS.map((s, i) => {
        const x = x0 + i * stepW;
        return (
          <g key={s.who}>
            <rect x={x} y={barY} width={stepW - 6} height={barH} rx={3}
                  fill="var(--color-bg-elevated)" stroke={s.t} strokeWidth={1.5} />
            <text x={x + (stepW - 6) / 2} y={barY + 34} textAnchor="middle" fill={s.t}
                  style={{ font: "500 13px var(--font-mono, monospace)" }}>{s.from}</text>
            <text x={x + (stepW - 6) / 2} y={barY - 12} textAnchor="middle" fill="var(--color-fg)"
                  style={{ font: "12px var(--font-sans, system-ui)" }}>{s.who}</text>
          </g>
        );
      })}
      {/* Outside the last box: right-aligned inside it collided with that box's
          own threshold label. */}
      <text x={x0 + STEPS.length * stepW + 4} y={barY + 34} textAnchor="start" fill={TONE.hot}
            style={{ font: "500 13px var(--font-mono, monospace)" }}>
        {STEPS[STEPS.length - 1]!.to}
      </text>
      <text x={x0} y={barY + barH + 26} fill="var(--color-fg-muted)"
            style={{ font: "12px var(--font-mono, monospace)" }}>
        size of one claim, left to right · not to scale
      </text>
    </svg>
  );
}
