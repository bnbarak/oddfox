import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { risk } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function RatesSlide() {
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
      <Eyebrow>10 — What it costs</Eyebrow>
      <Title>A percentage of the hull, per transit</Title>
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
        A $120m tanker at 0.125% costs $150,000 to move. The same hull at 10% costs $12m — for one
        transit, for seven days of cover. Lloyd&rsquo;s List reported single Hormuz transits running
        $10m to $14m in mid-2026.
      </Body>
      <Body>
        The premium is a map of weapon reach, not of distance. In July 2026 Bab el-Mandeb was five
        times the price of the northern Red Sea a few hundred miles away.
      </Body>
      <div style={source}>Sources: S&amp;P Global Platts citing Marsh; Reuters; Al Jazeera</div>
    </Slide>
  );
}
