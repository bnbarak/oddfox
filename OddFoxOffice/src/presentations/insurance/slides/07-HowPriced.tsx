import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, FadeItem } from "../../../presentation/SlideText";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const STEPS = [
  { n: "01", h: "The committee lists the area", b: "The Joint War Committee publishes its Listed Areas circular. That is all it does — it sets no rates." },
  { n: "02", h: "Listing suspends your cover", b: "The owner's annual war policy excludes the listed area. Entering it breaches the cover." },
  { n: "03", h: "The owner must give notice", b: "Written notice before entry. No notice, no cover — the vessel is uninsured for the transit." },
  { n: "04", h: "The underwriter quotes, or declines", b: "A bespoke additional premium: a percentage of insured value for a fixed period, normally seven days, quoted within about 48 hours." },
  { n: "05", h: "Or the area changes under you", b: "Areas can be added mid-policy on seven days' notice by circular." },
];

export function HowPricedSlide() {
  return (
    <Slide align="start">
      <Eyebrow>08 — The mechanism</Eyebrow>
      <Title>How a war risk premium is actually set</Title>
      <div className="slide__grid slide__grid--5">
        {STEPS.map((s) => (
          <FadeItem key={s.n}>
            <div style={card}>
              <div style={{ ...statSub, color: TONE.warm }}>{s.n}</div>
              <div style={{ ...statLabel, fontWeight: 500 }}>{s.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.7rem", lineHeight: 1.5 }}>{s.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Sources: Lloyd&rsquo;s Market Association; Hellenic War Risks; Institute War and Strikes Clauses</div>
    </Slide>
  );
}
