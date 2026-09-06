import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, FadeItem } from "../../../presentation/SlideText";
import { attackLog, platforms } from "../data";
import { source, TONE } from "../slide-design-system";

const points = [
  {
    claim: "Escort does not prevent engagement.",
    detail:
      "The Maersk Yorktown was fired on in April 2024 while under escort by USS Mason and USS Laboon. Escort changes the outcome, not the odds of being shot at.",
  },
  {
    claim: "Nearly half the losses happen at anchor.",
    detail: "15 of the 32 successful attacks in H1 2026 were on anchored ships — where an escort vessel is not.",
  },
  {
    claim: "Enforcement can close a market in one quarter.",
    detail:
      "Two Indonesian Marine Police arrests in July 2025 cut Malacca and Singapore incidents by 74% year on year.",
  },
  {
    claim: "Range figures are mostly unfalsifiable.",
    detail:
      "Only 17 of 39 platforms publish a range, usually without conditions. BlackSea's 1,626 nm is at 40 knots, Sea State 0, zero payload.",
  },
];

export function HonestSlide() {
  void attackLog; void platforms;
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>07 — What cuts against us</Eyebrow>
      <Title>The awkward findings</Title>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.5rem" }}>
        {points.map((p) => (
          <FadeItem key={p.claim}>
            <div style={{ borderLeft: `2px solid ${TONE.warm}`, paddingLeft: "1.25rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1.15rem" }}>{p.claim}</div>
              <div style={{ color: "var(--color-fg-muted)", marginTop: ".4rem", lineHeight: 1.55 }}>{p.detail}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Every one of these is in the library with its source. None of it is hidden.</div>
    </Slide>
  );
}
