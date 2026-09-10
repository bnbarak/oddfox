import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { own } from "../data";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function CharterSlide() {
  const types = own.charter_types as Record<string, string>[];
  return (
    <Slide align="start">
      <Eyebrow>06 — Who uses it</Eyebrow>
      <Title>The owner owns it. The charterer uses it.</Title>
      <Body>
        A charter is a rental. What is rented — one voyage, a period of time, or the bare hull —
        decides who crews the ship and who pays for its risks.
      </Body>
      <div className="slide__grid slide__grid--4">
        {types.map((c) => (
          <FadeItem key={c.id}>
            <div style={card}>
              <div style={{ ...statLabel, fontWeight: 500 }}>{c.name}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.6rem", lineHeight: 1.45 }}>{c.what_is_rented}</div>
              <div style={{ ...statSub, marginTop: "0.9rem" }}>Crewed by {c.who_crews}</div>
              <div style={{ ...statSub, color: TONE.warm, marginTop: "0.3rem", textTransform: "none", letterSpacing: 0 }}>
                War risk paid by: {c.war_risk_premium_usually_borne_by}
              </div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: ownership-model.json</div>
    </Slide>
  );
}
