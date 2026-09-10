import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const IDS = [
  { h: "The name", tag: "changes", t: TONE.warm,
    b: "Changes when the ship is sold, and several ships can carry the same name at once." },
  { h: "The flag", tag: "changes", t: TONE.warm,
    b: "Re-registered freely. The tanker Honour 25 moved from Cameroon to Palau and kept trading." },
  { h: "The owner", tag: "changes", t: TONE.warm,
    b: "Usually a company that owns exactly this one ship, sold along with it." },
  { h: "The IMO number", tag: "never changes", t: TONE.calm,
    b: "Seven digits, issued once when the hull is built and never reused. It survives every sale." },
];

export function OneShipSlide() {
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>02 — The unit</Eyebrow>
      <Title>A ship is usually its own company</Title>
      <Body>
        Most ocean-going ships are owned by a company that exists to own that one ship. Almost
        everything about it can change.
      </Body>
      <div className="slide__grid slide__grid--4">
        {IDS.map((x) => (
          <FadeItem key={x.h}>
            <div style={card}>
              <div style={{ ...statSub, color: x.t }}>{x.tag}</div>
              <div style={{ ...statLabel, fontWeight: 500 }}>{x.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.7rem", lineHeight: 1.5 }}>{x.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Sources: International Maritime Organization; incidents.json</div>
    </Slide>
  );
}
