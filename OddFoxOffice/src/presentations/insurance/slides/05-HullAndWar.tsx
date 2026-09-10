import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, FadeItem } from "../../../presentation/SlideText";
import { layer } from "../data";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function HullAndWarSlide() {
  const hull = layer("hull-and-machinery");
  const war = layer("war-risk");
  const pair = [
    { l: hull, t: TONE.cool, tag: "The default policy" },
    { l: war, t: TONE.hot, tag: "Bought back separately" },
  ];
  return (
    <Slide align="start">
      <Eyebrow>05 — The cut that matters</Eyebrow>
      <Title>Hull insurance does not answer a missile</Title>
      <div className="slide__grid slide__grid--2">
        {pair.map(({ l, t, tag }) => (
          <FadeItem key={l.id}>
            <div style={card}>
              <div style={{ ...statSub, color: t }}>{tag}</div>
              <div style={{ ...statLabel, fontWeight: 500, fontSize: "1.2rem" }}>{l.layer}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.9rem", lineHeight: 1.5 }}>
                <strong>Covers.</strong> {l.covers}
              </div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.7rem", lineHeight: 1.5, color: t }}>
                <strong>Excludes.</strong> {l.excludes}
              </div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: insurance-market.json</div>
    </Slide>
  );
}
