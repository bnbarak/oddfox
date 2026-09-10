import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { figure } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function PandISlide() {
  const share = figure("ig-tonnage-share");
  const tonnage = figure("ig-tonnage");
  const tower = figure("ig-gxl");
  const items = [
    { v: share.value + "%", l: "of world ocean-going tonnage", s: "covered by twelve clubs", t: TONE.calm },
    { v: tonnage.value + "bn", l: "gross tonnes insured", s: "up from 2.5m GT in 1953", t: TONE.cool },
    { v: "$" + tower.value + "bn", l: "cover above the club retention", s: "pooled and reinsured together", t: TONE.warm },
  ];
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>06 — Third-party liability</Eyebrow>
      <Title>A &ldquo;club&rdquo; is a mutual owned by the shipowners it insures</Title>
      <Body>
        No shareholders. Members pay <em>calls</em>, not premiums, and a bad year brings a
        supplementary call — so members stand behind each other. Twelve of them cover the
        third-party side hull insurance ignores: crew, pollution, wreck removal, cargo and
        collision liability.
      </Body>
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
      <div style={source}>Sources: International Group of P&amp;I Clubs; Gallagher</div>
    </Slide>
  );
}
