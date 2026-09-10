import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { clubs } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function WhyClubsSlide() {
  const oldest = clubs().filter((c) => c.founded).sort((a, b) => a.founded - b.founded).slice(0, 4);
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>11 — Why they exist</Eyebrow>
      <Title>Owners insured each other because nobody else would</Title>
      <Body>
        In the nineteenth century the commercial market would insure the ship itself, but largely
        not the harm a ship did to others. So shipowners formed clubs and covered each other.
        Some of those clubs are still here.
      </Body>
      <div className="slide__grid slide__grid--4">
        {oldest.map((c) => (
          <FadeItem key={c.id}>
            <div style={card}>
              <div style={{ ...statValue, color: TONE.calm }}>{c.founded}</div>
              <div style={statLabel}>{c.name}</div>
              <div style={statSub}>{c.domicile}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Sources: club histories; insurance-market.json</div>
    </Slide>
  );
}
