import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { figure } from "../data";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function NotInClubSlide() {
  const un = figure("uninsured-tankers");
  const rest = [
    { h: "Fixed-premium cover", tag: "a policy, not a membership", t: TONE.cool,
      b: "Commercial insurers selling liability cover as an ordinary policy — no mutuality, no Pool, no supplementary call. Mostly smaller ships. The Rubymar's cover was this kind." },
    { h: "Outside the twelve", tag: "a mutual, but not in the Group", t: TONE.warm,
      b: "Maritime Mutual of New Zealand was one — and covered almost one in six of all Western-sanctioned shadow-fleet tankers." },
    { h: `${un.value}% of tankers`, tag: "nothing anyone can verify", t: TONE.hot,
      b: "No insurance anyone can identify. Some carry certificates from insurers that turned out not to meaningfully exist." },
  ];
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>15 — Outside the clubs</Eyebrow>
      <Title>Not every ship is in a club</Title>
      <Body>
        The twelve cover the legitimate ocean-going fleet. The rest is where cover is thinnest —
        and sometimes where it is fictitious.
      </Body>
      <div className="slide__grid">
        {rest.map((x) => (
          <FadeItem key={x.h}>
            <div style={card}>
              <div style={{ ...statSub, color: x.t }}>{x.tag}</div>
              <div style={{ ...statLabel, fontWeight: 500 }}>{x.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.7rem", lineHeight: 1.5 }}>{x.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Sources: KSE Institute; Reuters; Lloyd&rsquo;s List</div>
    </Slide>
  );
}
