import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { ins } from "../data";
import { card, statLabel, statSub, source } from "../../oddfox/slide-design-system";

export function CoverStackSlide() {
  const layers = ins.layers as { id: string; layer: string; covers: string }[];
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>04 — The stack</Eyebrow>
      <Title>Eight covers, not one policy</Title>
      <Body>
        Each is a different contract, insurer and often broker. Nobody sells &ldquo;ship insurance&rdquo;.
      </Body>
      <div className="slide__grid slide__grid--4">
        {layers.map((l) => (
          <FadeItem key={l.id}>
            <div style={card}>
              <div style={{ ...statLabel, fontWeight: 500 }}>{l.layer}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.6rem", lineHeight: 1.45 }}>
                {l.covers.length > 130 ? l.covers.slice(0, 128) + "…" : l.covers}
              </div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: insurance-market.json</div>
    </Slide>
  );
}
