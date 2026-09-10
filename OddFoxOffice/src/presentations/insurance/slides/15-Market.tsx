import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { figure } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function MarketSlide() {
  const total = figure("global-marine-premium");
  const share = figure("marine-war-share");
  const london = figure("london-war-premium");
  const items = [
    { v: "$" + total.value + "bn", l: "global marine premium", s: "2024 — cargo 57%, hull 24%", t: TONE.cool },
    { v: String(share.value), l: "marine war as a share of it", s: "two independent bodies agree on this", t: TONE.warm },
    { v: "£" + london.value + "m", l: "marine war premium, London company market", s: "the only discrete figure published anywhere", t: TONE.hot },
  ];
  return (
    <Slide align="start">
      <Eyebrow>16 — The size of it</Eyebrow>
      <Title>A rounding error that decides whether trade moves</Title>
      <div className="slide__grid">
        {items.map((i) => (
          <FadeItem key={i.l}>
            <div style={card}>
              <div style={{ ...statValue, color: i.t }}>{i.v}</div>
              <div style={statLabel}>{i.l}</div>
              <div style={statSub}>{i.s}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <Body>
        Two or three percent of marine premium. When it repriced in 2026, Hormuz traffic fell from
        about 140 vessels a day to roughly ten. Lloyd&rsquo;s took £1.4bn of net losses; IUMI put marine
        claims from the Gulf conflict at $1.5–2bn across about 70 casualties.
      </Body>
      <div style={source}>Sources: IUMI, the marine insurers&rsquo; trade body; the IUA, London&rsquo;s company market; Howden Re; Lloyd&rsquo;s</div>
    </Slide>
  );
}
