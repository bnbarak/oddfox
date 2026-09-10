import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title } from "../../../presentation/SlideText";
import { own } from "../data";
import { source, TONE } from "../../oddfox/slide-design-system";

/* The synthesis slide: every party from the previous slides around one hull,
   coloured by the kind of relationship each has to the ship. The cargo owner
   sits underneath, joined to the hull itself, because it owns what is inside
   rather than the ship — and because no ship registry records it.

   Labels are written out rather than read from the data, because the data's
   own labels carry an acronym ("Technical / ISM manager") a newcomer can't read. */

const LABEL: Record<string, string> = {
  "flag-state": "Flag state",
  "registered-owner": "Registered owner",
  "beneficial-owner": "Beneficial owner",
  "technical-manager": "Technical manager",
  "commercial-manager": "Commercial manager",
  "charterer": "Charterer",
  "p-and-i-club": "Club (protection and indemnity)",
  "war-risk-underwriter": "War risk underwriter",
  "beneficial-cargo-owner": "Beneficial cargo owner",
};

const LAYER: Record<string, { name: string; t: string }> = {
  legal: { name: "legal", t: TONE.cool },
  economic: { name: "money", t: TONE.calm },
  operational: { name: "operations", t: TONE.paper },
  commercial: { name: "trade", t: TONE.warm },
  cargo: { name: "cargo — owns what is inside", t: TONE.warm },
  risk: { name: "insurance", t: TONE.hot },
};

const LEFT = ["flag-state", "registered-owner", "beneficial-owner", "technical-manager"];
const RIGHT = ["commercial-manager", "charterer", "p-and-i-club", "war-risk-underwriter"];
const YS = [8, 84, 160, 236];
const HULL_Y = 158;

export function PartiesSlide() {
  const byId = Object.fromEntries((own.records as Record<string, any>[]).map((r) => [r.id, r]));

  const box = (id: string, x: number, y: number, from: [number, number], to: [number, number]) => {
    const lay = LAYER[byId[id]?.layer] ?? { name: String(byId[id]?.layer ?? ""), t: TONE.paper };
    return (
      <g key={id}>
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="var(--color-border)" strokeWidth={1} />
        <rect x={x} y={y} width={320} height={54} rx={3}
              fill="var(--color-bg-elevated)" stroke={lay.t} strokeWidth={1.5} />
        <text x={x + 16} y={y + 24} fill="var(--color-fg)"
              style={{ font: "500 15px var(--font-sans, system-ui)" }}>{LABEL[id]}</text>
        <text x={x + 16} y={y + 43} fill={lay.t}
              style={{ font: "11px var(--font-mono, monospace)", letterSpacing: "0.08em" }}>
          {lay.name.toUpperCase()}
        </text>
      </g>
    );
  };

  return (
    <Slide align="start">
      <Eyebrow>08 — Putting it together</Eyebrow>
      <Title>Nine parties, one hull</Title>
      <svg viewBox="0 0 1180 300" style={{ width: "100%", height: "auto", marginTop: "0.5rem" }}
           role="img" aria-label="One hull in the centre. On the left the flag state, registered owner, beneficial owner and technical manager; on the right the commercial manager, charterer, club and war risk underwriter; and beneath the hull the beneficial cargo owner, who owns what is inside.">
        {LEFT.map((id, i) => box(id, 30, YS[i]!, [350, YS[i]! + 27], [486, HULL_Y]))}
        {RIGHT.map((id, i) => box(id, 830, YS[i]!, [830, YS[i]! + 27], [694, HULL_Y]))}
        {box("beneficial-cargo-owner", 430, 236, [590, 236], [590, 176])}
        <text x={590} y={96} textAnchor="middle" fill="var(--color-fg-muted)"
              style={{ font: "12px var(--font-mono, monospace)" }}>one hull · one IMO number</text>
        <rect x={604} y={110} width={50} height={30} rx={2}
              fill="var(--color-bg-elevated)" stroke="var(--color-fg)" strokeWidth={1.5} />
        <path d="M 480 140 L 700 140 L 676 176 L 504 176 Z"
              fill="var(--color-bg-elevated)" stroke="var(--color-fg)" strokeWidth={1.5} />
      </svg>
      <div style={source}>Source: ownership-model.json</div>
    </Slide>
  );
}
