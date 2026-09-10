import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const CASES = [
  { v: "Sounion", id: "Greek crude tanker, a million barrels aboard, set on fire August 2024",
    t: TONE.cool, h: "Entered with a club. The club paid nothing.",
    b: "Gard was its P&I club and carried no exposure at all, because the loss was a war risk and the war exclusion applied. Brit's Keel Consortium held 100% of the war cover and funded the salvage." },
  { v: "Galaxy Leader", id: "Car carrier, boarded from a helicopter November 2023; 25 crew held 430 days",
    t: TONE.warm, h: "Seven war underwriters paid. The eighth refused.",
    b: "Ascot 25%, Markel 20%, Swiss Re 15%, Arch, Skuld and Tokio Marine HCC 12.5% each, Ark 2.5%. Separately, Codan is reported to have refused the loss-of-hire claim, arguing the Houthis are not a state power, as the Nordic Plan — the standard Scandinavian policy wording — requires." },
  { v: "Rubymar", id: "Fertiliser cargo ship, missile-struck February 2024 — the first vessel sunk",
    t: TONE.hot, h: "Twenty-three providers, none of them liable.",
    b: "Thomas Miller Specialty had told assureds that reinsurers could no longer support war risks in the area from 20 February. The ship was hit on the 18th. Lloyd's List approached 23 P&I providers; all confirmed they did not cover her." },
];

export function SeamsSlide() {
  return (
    <Slide align="start">
      <Eyebrow>11 — Where claims die</Eyebrow>
      <Title>At the seam between two layers</Title>
      <div className="slide__grid">
        {CASES.map((c) => (
          <FadeItem key={c.v}>
            <div style={card}>
              <div style={{ ...statSub, color: c.t }}>{c.v}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.3rem", lineHeight: 1.4, opacity: 0.75 }}>{c.id}</div>
              <div style={{ ...statLabel, fontWeight: 500, marginTop: "0.7rem" }}>{c.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.8rem", lineHeight: 1.5 }}>{c.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <Body>
        Being entered with a club tells you nothing about who pays for a missile. The question is
        always which layer the peril lands in — and every boundary is a place a claim can fall through.
      </Body>
      <div style={source}>Source: insurance-market.json</div>
    </Slide>
  );
}
