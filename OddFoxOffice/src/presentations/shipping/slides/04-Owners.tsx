import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, FadeItem } from "../../../presentation/SlideText";
import { party } from "../data";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function OwnersSlide() {
  const pair = [
    { p: party("registered-owner"), tag: "Owner on paper — free to look up", t: TONE.cool },
    { p: party("beneficial-owner"), tag: "Owner in fact — usually costs money to find", t: TONE.calm },
  ];
  return (
    <Slide align="start">
      <Eyebrow>04 — Two owners</Eyebrow>
      <Title>The name on the papers is rarely the one that decides</Title>
      <div className="slide__grid slide__grid--2">
        {pair.map(({ p, tag, t }) => (
          <FadeItem key={p.id}>
            <div style={card}>
              <div style={{ ...statSub, color: t }}>{tag}</div>
              <div style={{ ...statLabel, fontWeight: 500, fontSize: "1.15rem" }}>{p.role}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.8rem", lineHeight: 1.5 }}>{p.definition}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.7rem", lineHeight: 1.5, color: t }}>{p.who_it_usually_is}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: ownership-model.json</div>
    </Slide>
  );
}
