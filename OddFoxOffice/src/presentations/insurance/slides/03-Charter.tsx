import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { own } from "../data";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function CharterSlide() {
  const types = own.charter_types as {
    id: string; name: string; what_is_rented: string;
    war_risk_premium_usually_borne_by?: string;
  }[];
  return (
    <Slide align="start">
      <Eyebrow>03 — Who actually pays</Eyebrow>
      <Title>The owner owns the steel. The charterer often pays the premium.</Title>
      <div className="slide__grid slide__grid--4">
        {types.map((c) => {
          const payer = c.war_risk_premium_usually_borne_by ?? "—";
          return (
            <FadeItem key={c.id}>
              <div style={card}>
                <div style={{ ...statLabel, fontWeight: 500 }}>{c.name}</div>
                <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.6rem" }}>
                  {c.what_is_rented}
                </div>
                <div style={{ ...statSub, color: /[Cc]harterer/.test(payer) ? TONE.hot : TONE.cool, marginTop: "1rem" }}>
                  War risk borne by: {payer}
                </div>
              </div>
            </FadeItem>
          );
        })}
      </div>
      <Body>
        Under most time and voyage charters the charterer bears the war risk premium. The party
        with the budget is often not the one that owns the ship.
      </Body>
      <div style={source}>Source: ownership-model.json</div>
    </Slide>
  );
}
