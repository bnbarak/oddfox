import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const CREDITED = [
  { h: "Speed and freeboard", b: "Marsh's kidnap and ransom baseline is 14 knots and five metres of freeboard. Both sit in the ship's particulars and in class records.", t: TONE.calm },
  { h: "Installed equipment", b: "Norwegian Hull Club grants an environmental allowance inside its published rating model for named installed systems — audited by an independent data partner.", t: TONE.calm },
  { h: "Loss record", b: "No-claims bonuses and volume discounts. The owner SFL disclosed a $2.6m no-claims bonus from DNK, the Norwegian war-risk mutual, in an SEC filing.", t: TONE.cool },
  { h: "An escort", b: "Present or absent per voyage, and knowable only if somebody attests to it. Never priced by anyone.", t: TONE.hot },
];

export function VerifiableSlide() {
  return (
    <Slide align="start">
      <Eyebrow>18 — Why</Eyebrow>
      <Title>Underwriters price what they can verify without trusting you</Title>
      <div className="slide__grid slide__grid--4">
        {CREDITED.map((c) => (
          <FadeItem key={c.h}>
            <div style={card}>
              <div style={{ ...statLabel, fontWeight: 500, color: c.t }}>{c.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.8rem", lineHeight: 1.5 }}>{c.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <Body>
        The question worth asking an underwriter is not what discount they would give. It is:
        <em> what would an escort&rsquo;s load line look like — what would you need to see, from whom, to
        treat it as a fact rather than a claim?</em>
      </Body>
      <div style={source}>Sources: Marsh; Norwegian Hull Club; SFL Corporation SEC filing</div>
    </Slide>
  );
}
