import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { figure } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function WhyItMattersSlide() {
  const share = figure("ig-tonnage-share");
  const items = [
    { v: "12", l: "organisations", s: "the whole International Group", t: TONE.calm },
    { v: `${share.value}%`, l: "of ocean-going tonnage", s: "sits behind those twelve", t: TONE.cool },
    { v: "1", l: "precedent already", s: "a risk-data firm sold to NorthStandard, which gave it to its members", t: TONE.warm },
  ];
  return (
    <Slide align="start" tone="accent">
      <Eyebrow>17 — Why this matters to us</Eyebrow>
      <Title>Twelve doors instead of thousands</Title>
      <Body>
        Because of the Pool, a club&rsquo;s members pay part of each other&rsquo;s claims. Every club has a
        funded reason to back anything that prevents one — and a way to reach all its ships at once.
      </Body>
      <div className="slide__grid">
        {items.map((i) => (
          <FadeItem key={i.l}>
            <div style={card}>
              <div style={{ ...statValue, color: i.t }}>{i.v}</div>
              <div style={statLabel}>{i.l}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, lineHeight: 1.45 }}>{i.s}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Sources: International Group of P&amp;I Clubs; Risk Intelligence</div>
    </Slide>
  );
}
