import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { flags } from "../data";
import { card, statValue, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

/* Only the nations the source actually captured. It returned ranks 1, 3, 4, 8
   and 9; the rest are a recorded gap in the dataset, so they are deliberately
   not filled in from memory here. */

const BLURB: Record<string, string> = {
  China: "Most valuable bulk carrier and container fleets, and the largest tanker fleet by number.",
  Greece: "Fewer tankers than China, yet its tankers alone are worth $71.3bn — $23bn more.",
  Norway: "Second-largest owner of vehicle carriers in the world.",
  Switzerland: "No coastline at all, and still in the top ten. Ownership is a legal address.",
};

export function MoneySlide() {
  const sn = (flags as Record<string, any>).shipowning_nations;
  const shown = (sn.records as Record<string, any>[]).filter((r) => BLURB[r.nation]);
  return (
    <Slide align="start">
      <Eyebrow>07 — Where the money is</Eyebrow>
      <Title>The money lives somewhere else</Title>
      <Body>
        The nations that own the most shipping are not the ones that flag it. Follow the money,
        not the flag.
      </Body>
      <div className="slide__grid slide__grid--4">
        {shown.map((r) => (
          <FadeItem key={r.nation}>
            <div style={card}>
              <div style={{ ...statSub, color: TONE.calm }}>
                {r.fleet_value_usd_bn ? `$${r.fleet_value_usd_bn}bn fleet` : "total value not captured"}
              </div>
              <div style={{ ...statValue, fontSize: "clamp(1.6rem, 3vw, 2.4rem)" }}>#{r.rank}</div>
              <div style={{ ...statLabel, fontWeight: 500 }}>{r.nation}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.6rem", lineHeight: 1.45 }}>
                {BLURB[r.nation]}
              </div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>
        Source: Veson Nautical via flag-states.json, {sn.as_of}, ranked by fleet value. Ranks 2, 5, 6, 7 and 10 were not captured.
      </div>
    </Slide>
  );
}
