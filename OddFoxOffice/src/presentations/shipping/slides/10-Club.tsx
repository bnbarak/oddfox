import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const IDEAS = [
  { h: "No shareholders", t: TONE.calm,
    b: "Nobody owns a club to make a profit from it. The members own it, and a surplus stays with them." },
  { h: "Calls, not premiums", t: TONE.cool,
    b: "Members pay a contribution called a call, set each year from what the club expects to pay out." },
  { h: "A bad year costs more", t: TONE.warm,
    b: "If claims run over, the club levies a supplementary call. Members are genuinely on the hook for each other." },
  { h: "It covers everyone else", t: TONE.cool,
    b: "Injured or killed crew, pollution, wreck removal, ruined cargo, collisions — the damage a ship does to others." },
];

export function ClubSlide() {
  return (
    <Slide align="start" tone="accent">
      <Eyebrow>10 — The club</Eyebrow>
      <Title>A club is the shipowners themselves</Title>
      <Body>
        You do not buy cover from a club. You join one — and the members insure each other.
      </Body>
      <div className="slide__grid slide__grid--4">
        {IDEAS.map((x) => (
          <FadeItem key={x.h}>
            <div style={card}>
              <div style={{ ...statLabel, fontWeight: 500, color: x.t }}>{x.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.8rem", lineHeight: 1.5 }}>{x.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: International Group of P&amp;I Clubs</div>
    </Slide>
  );
}
