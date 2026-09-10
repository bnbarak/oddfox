import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { card, statValue, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const ROWS = [
  { p: "Kidnap and ransom", m: "Four-man unarmed team", c: "up to 25%", t: TONE.calm },
  { p: "Kidnap and ransom", m: "Armed team", c: "up to 50%", t: TONE.calm },
  { p: "War risk", m: "Holding a kidnap and ransom policy, with waiver of subrogation", c: "50%", t: TONE.warm },
  { p: "War risk", m: "Armed team aboard", c: "never quantified", t: TONE.hot },
];

export function NotPricedSlide() {
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>17 — What is not priced</Eyebrow>
      <Title>Security measures earn credit in the small product, not the big one</Title>
      <Body>
        Marsh, July 2011 — the only named, quantified precedent that exists, published on the
        International Group&rsquo;s own servers.
      </Body>
      <div className="slide__grid slide__grid--4">
        {ROWS.map((r, i) => (
          <FadeItem key={i}>
            <div style={card}>
              <div style={{ ...statValue, color: r.t, fontSize: "clamp(1.4rem, 2.6vw, 2rem)" }}>{r.c}</div>
              <div style={statLabel}>{r.m}</div>
              <div style={statSub}>{r.p}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Sources: Marsh, July 2011; Aon, September 2011; Oceans Beyond Piracy</div>
    </Slide>
  );
}
