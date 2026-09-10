import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const WHO = [
  { h: "Lloyd's of London", t: TONE.cool,
    b: "Not an insurance company — a marketplace. Syndicates of underwriters compete there to write risk, backed by outside capital. Ascot, Beazley, Brit, Markel and Atrium are syndicates trading in it." },
  { h: "The company market", t: TONE.cool,
    b: "Insurers operating in London that are not Lloyd's syndicates — AXA XL, Convex, Sompo, Munich Re, Fidelis. Represented by the International Underwriting Association." },
  { h: "The committee", t: TONE.warm,
    b: "About twenty working hull-war underwriters drawn from both halves, chaired from Ascot, advised by an independent security consultancy. They meet, and they publish one document." },
];

export function JWCSlide() {
  return (
    <Slide align="start" tone="accent">
      <Eyebrow>09 — The Joint War Committee</Eyebrow>
      <Title>Twenty underwriters decide where the map turns red</Title>
      <div className="slide__grid">
        {WHO.map((w) => (
          <FadeItem key={w.h}>
            <div style={card}>
              <div style={{ ...statLabel, fontWeight: 500, color: w.t }}>{w.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.7rem", lineHeight: 1.5 }}>{w.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <Body>
        That document is the <strong>Listed Areas circular</strong> — the one thing that turns a
        geography into a price. But the committee sets no rates: &ldquo;rating is a matter for
        individual negotiation between underwriters and brokers, and the JWC plays no role in that.&rdquo;
      </Body>
      <div style={source}>Source: Lloyd&rsquo;s Market Association, JWLA-034</div>
    </Slide>
  );
}
