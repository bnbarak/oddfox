import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { risk } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../slide-design-system";

export function CostSlide() {
  const prem = risk.premiums as { id: string; label: string; area: string; period: string }[];
  const pick = (id: string) => prem.find((p) => p.id === id)!;
  const items = [
    { p: pick("gulf-pre-crisis"), t: TONE.calm },
    { p: pick("red-sea-north-2026-07"), t: TONE.cool },
    { p: pick("bab-el-mandeb-2026-07"), t: TONE.warm },
    { p: pick("hormuz-2026-07"), t: TONE.hot },
  ];
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>03 — What risk costs</Eyebrow>
      <Title>The market already prices this</Title>
      <Body>
        War risk premium is a percentage of hull and machinery value, per transit. It is the
        only maritime risk figure that is already a line on someone&rsquo;s voyage budget.
      </Body>
      <div className="slide__grid">
        {items.map(({ p, t }) => (
          <FadeItem key={p.id}>
            <div style={card}>
              <div style={{ ...statValue, color: t }}>{p.label}</div>
              <div style={statLabel}>{p.area}</div>
              <div style={statSub}>{p.period}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <Body>
        A $100m hull at 0.125% costs $125,000 to move. The same hull at 10% costs $10m.
      </Body>
      <div style={source}>Sources: Al Jazeera citing S&amp;P Global; SupplyChainBrain</div>
    </Slide>
  );
}
