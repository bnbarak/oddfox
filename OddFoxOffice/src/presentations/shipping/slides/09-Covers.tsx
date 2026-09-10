import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { layer } from "../data";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const COVERS = [
  { id: "hull-and-machinery", who: "shipowner", t: TONE.cool,
    b: "Physical loss or damage to the ship from ordinary perils — grounding, collision, fire, weather. War is excluded." },
  { id: "war-risk", who: "shipowner", t: TONE.hot,
    b: "The war perils struck out of hull cover and bought back, priced per transit as a percentage of the ship's value." },
  { id: "p-and-i", who: "shipowner, through the club", t: TONE.calm,
    b: "Liability to everyone else — injured crew, pollution, wreck removal, other people's cargo." },
  { id: "cargo", who: "cargo owner", t: TONE.warm,
    b: "The goods themselves. A separate policy from a separate insurer, bought by whoever owns the cargo." },
];

export function CoversSlide() {
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>09 — Insurance</Eyebrow>
      <Title>Four covers, two owners</Title>
      <Body>
        The shipowner buys the first three. The cargo owner buys the fourth — and it is the largest
        line in all of marine insurance, 56.7% of the world&rsquo;s marine premium.
      </Body>
      <div className="slide__grid slide__grid--4">
        {COVERS.map((x) => (
          <FadeItem key={x.id}>
            <div style={card}>
              <div style={{ ...statSub, color: x.t }}>bought by the {x.who}</div>
              <div style={{ ...statLabel, fontWeight: 500 }}>{layer(x.id).layer}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.8rem", lineHeight: 1.5 }}>{x.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Sources: insurance-market.json; IUMI, 2024. The full stack has eight covers — the insurance deck walks through all of them.</div>
    </Slide>
  );
}
