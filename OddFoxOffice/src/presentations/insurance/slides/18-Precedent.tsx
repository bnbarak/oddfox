import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, FadeItem } from "../../../presentation/SlideText";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const TRIED = [
  { h: "Convoy Escort Programme", y: "2010–2016", t: TONE.hot,
    b: "Jardine Lloyd Thompson, with Ascot and Chartis, planned to bundle escorts with seven days of war cover. Companies House shows the company filed dormant accounts, never raised past £1 of share capital, and was struck off in 2016. The announced $30m never reached the operating entity." },
  { h: "Typhon", y: "2011–2013", t: TONE.hot,
    b: "Sold on a 50–80% premium reduction its founder never contracted for. He held a broker's letter, not an agreement. Never launched at scale." },
  { h: "Nigeria, Deep Blue", y: "2021–", t: TONE.warm,
    b: "A state spent $195m on naval capability, moved the incident statistics, and got an IMB delisting. Nigeria remains an additional premium area in NorthStandard's 2026/27 circular." },
  { h: "Ambrey", y: "2025–", t: TONE.calm,
    b: "Stopped asking for a discount and became the underwriter. A Lloyd's coverholder writing spot-breach hull war, capacity led by MS Amlin, with its own security services embedded in the policy." },
];

export function PrecedentSlide() {
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>19 — Everyone who has tried this</Eyebrow>
      <Title>Three failed the same way. One did something different.</Title>
      <div className="slide__grid slide__grid--4">
        {TRIED.map((x) => (
          <FadeItem key={x.h}>
            <div style={card}>
              <div style={{ ...statSub, color: x.t }}>{x.y}</div>
              <div style={{ ...statLabel, fontWeight: 500 }}>{x.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.7rem", lineHeight: 1.5 }}>{x.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Sources: Companies House; Berube &amp; Cullen; NorthStandard; EEAS</div>
    </Slide>
  );
}
