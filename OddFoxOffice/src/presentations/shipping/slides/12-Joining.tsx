import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, FadeItem } from "../../../presentation/SlideText";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const FACTS = [
  { h: "Entry is per ship", t: TONE.cool,
    b: "An owner enters each hull separately, and a large fleet is often split across several clubs." },
  { h: "The blue card", t: TONE.cool,
    b: "The club issues a certificate of cover. The flag state uses it to issue the certificates the ship must carry." },
  { h: "Compulsory in practice", t: TONE.warm,
    b: "No single law says so, but ports, charterers, lending banks and international conventions all require it. Without it a ship cannot trade." },
  { h: "The member may not be the owner", t: TONE.paper,
    b: "It can be the registered owner, a bareboat charterer or the manager. Charterers buy their own, separate cover." },
];

export function JoiningSlide() {
  return (
    <Slide align="start">
      <Eyebrow>12 — Joining</Eyebrow>
      <Title>You enter a ship, not yourself</Title>
      <div className="slide__grid slide__grid--4">
        {FACTS.map((x) => (
          <FadeItem key={x.h}>
            <div style={card}>
              <div style={{ ...statLabel, fontWeight: 500, color: x.t }}>{x.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.8rem", lineHeight: 1.5 }}>{x.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Sources: International Group of P&amp;I Clubs; ownership-model.json</div>
    </Slide>
  );
}
