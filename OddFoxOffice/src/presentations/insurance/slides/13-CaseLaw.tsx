import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { ins } from "../data";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function CaseLawSlide() {
  const cases = (ins.case_law as any[]).filter((c) => c.citation).slice(0, 4);
  const tone = (w: string) => (w === "insurer" ? TONE.hot : w === "assured" ? TONE.calm : TONE.warm);
  return (
    <Slide align="start">
      <Eyebrow>14 — The judgments</Eyebrow>
      <Title>What actually decides who pays</Title>
      <Body>
        Not the policy wording alone. English courts built the rules, and insurers win about as
        often as they lose.
      </Body>
      <div className="slide__grid slide__grid--4">
        {cases.map((c) => (
          <FadeItem key={c.id}>
            <div style={card}>
              <div style={{ ...statSub, color: tone(c.who_won) }}>
                {c.who_won === "pending" ? "undecided" : c.who_won + " won"}
              </div>
              <div style={{ ...statLabel, fontWeight: 500 }}>{c.case.split("(")[0].trim()}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.6rem" }}>
                {c.citation}
              </div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.7rem", lineHeight: 1.5 }}>
                {c.held.length > 180 ? c.held.slice(0, 178) + "…" : c.held}
              </div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: insurance-market.json</div>
    </Slide>
  );
}
