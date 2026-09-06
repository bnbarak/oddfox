import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { point, attackLog } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../slide-design-system";

export function ThreatSlide() {
  const p = attackLog.patterns_2026_h1;
  const stats = [
    { v: String(point("imb-global-annual", "2025")), l: "incidents worldwide, 2025", s: "IMB · five-year high", t: TONE.warm },
    { v: String(point("imb-global-halfyear", "2026-H1")), l: "incidents worldwide, H1 2026", s: "lowest half-year since 1992", t: TONE.calm },
    { v: `${p.success_rate_pct}%`, l: "of approaches still succeeded", s: "32 of 38 boarded or hijacked", t: TONE.hot },
    { v: String(p.crew_affected), l: "seafarers harmed or coerced", s: `${p.crew_breakdown[0].value} taken hostage`, t: TONE.hot },
  ];
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>01 — The threat</Eyebrow>
      <Title>Fewer attacks. Not less risk.</Title>
      <Body>
        The headline count fell to its lowest half-year since 1992. More crew were taken
        hostage from those 38 incidents than from all 137 incidents of 2025.
      </Body>
      <div className="slide__grid">
        {stats.map((s) => (
          <FadeItem key={s.l}>
            <div style={card}>
              <div style={{ ...statValue, color: s.t }}>{s.v}</div>
              <div style={statLabel}>{s.l}</div>
              <div style={statSub}>{s.s}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: ICC International Maritime Bureau, annual and half-year reports</div>
    </Slide>
  );
}
