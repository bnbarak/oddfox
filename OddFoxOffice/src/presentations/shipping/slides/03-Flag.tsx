import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { flags } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

/* "Carrying capacity" rather than the data's own term, deadweight tonnage:
   the same measure, but a newcomer can read it. */

export function FlagSlide() {
  const c = (flags as Record<string, any>).concentration;
  const three = (c.top_three as string[]).join(", ");
  const items = [
    { v: `${c.share_world_dwt_pct}%`, l: "of the world's carrying capacity", s: `flies one of three flags — ${three}`, t: TONE.hot },
    { v: `${c.share_world_fleet_value_pct}%`, l: "of the world fleet by value", s: "the same three flags", t: TONE.warm },
    { v: `${c.share_world_vessel_count_pct}%`, l: "of the world's ships by number", s: "because they register the biggest ships", t: TONE.cool },
  ];
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>03 — The flag</Eyebrow>
      <Title>The flag is a legal choice, not a nationality</Title>
      <Body>
        The flag is the country whose law applies on board. Owners choose it, and most choose
        an open registry — one that accepts a ship owned by anyone, anywhere.
      </Body>
      <div className="slide__grid">
        {items.map((i) => (
          <FadeItem key={i.l}>
            <div style={card}>
              <div style={{ ...statValue, color: i.t }}>{i.v}</div>
              <div style={statLabel}>{i.l}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, lineHeight: 1.45 }}>{i.s}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: UNCTAD via flag-states.json, as at {c.as_of}</div>
    </Slide>
  );
}
