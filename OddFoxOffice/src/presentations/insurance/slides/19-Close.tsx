import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { ins } from "../data";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function CloseSlide() {
  const qs = (ins.open_questions as string[]).slice(0, 3);
  return (
    <Slide align="start">
      <Eyebrow>20 — What we still cannot answer</Eyebrow>
      <Title>The honest close</Title>
      <Body>
        Three things the record supports, and one it does not. Supported: a war risk broker letter
        confirming an escort causes no change in cover; a club letter confirming it does not
        prejudice cover; a contract the club will approve. Not supported: any promised discount.
      </Body>
      <div className="slide__grid">
        {qs.map((q, i) => (
          <FadeItem key={i}>
            <div style={card}>
              <div style={{ ...statSub, color: TONE.warm }}>Open question {i + 1}</div>
              <div style={{ ...statLabel, lineHeight: 1.5 }}>{q}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: insurance-market.json — open questions</div>
    </Slide>
  );
}
