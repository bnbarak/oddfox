import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { figure } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

export function UninsuredSlide() {
  const un = figure("uninsured-tankers");
  const items = [
    { v: un.value + "%", l: "of the global tanker fleet", s: "no identifiable insurance — 5,134 vessels", t: TONE.hot },
    { v: "29.4%", l: "of tankers carrying Russian crude", s: "had International Group cover in 2024", t: TONE.warm },
    { v: "90%+", l: "produce a certificate when challenged", s: "Finland ~95%, Estonia ~92%", t: TONE.cool },
  ];
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>15 — The other fleet</Eyebrow>
      <Title>A paper gap, not a certificate gap</Title>
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
        Those figures are not in conflict. Over 90% of shadow-fleet ships produce a certificate on
        demand — and 36.5% of the tanker fleet has no cover anyone can verify. The gap is between a
        document produced at a checkpoint and an insurer that would actually pay.
      </Body>
      <Body>
        Three named faces of it: <strong>Romarine</strong>, which forged the Norwegian regulator&rsquo;s own
        letterhead; <strong>Seaguard P&amp;I</strong>, whose registered address is a residential flat in
        Pinneberg; and <strong>Maritime Mutual</strong> — real, Lloyd&rsquo;s-reinsured, covering almost one in
        six of all sanctioned shadow tankers.
      </Body>
      <div style={source}>Sources: KSE Institute; Reuters; Lloyd&rsquo;s List</div>
    </Slide>
  );
}
