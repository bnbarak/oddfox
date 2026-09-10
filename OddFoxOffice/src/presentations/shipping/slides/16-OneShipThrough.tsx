import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, FadeItem } from "../../../presentation/SlideText";
import { incident, vessel } from "../data";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

/* Everything in the deck applied to one real hull. Sounion is the right one
   because every party is on the public record, and because what happened to
   it is the clearest illustration of the club and the war cover being
   separate things. */

export function OneShipThroughSlide() {
  const inc = incident("sounion-2024");
  const cover = vessel("sounion").cover as { layer: string; insurer: string }[];
  const find = (l: string) => cover.find((c) => c.layer === l)?.insurer ?? "not found";
  const rows: [string, string][] = [
    ["IMO number", String(inc.vessel.imo)],
    ["What it is", "Crude oil tanker, about a million barrels aboard"],
    ["Flag", String(inc.ownership_chain.flag_state)],
    ["Commercial manager", String(inc.ownership_chain.commercial_manager)],
    ["Club", find("p-and-i")],
    ["War risk underwriter", `${find("war-risk")}, all of it`],
    ["Salvor", find("salvage")],
  ];
  return (
    <Slide align="start">
      <Eyebrow>16 — One ship, all the way through</Eyebrow>
      <Title>The Sounion</Title>
      <div className="slide__grid slide__grid--2">
        <FadeItem>
          <div style={card}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: "1rem",
                                    padding: "0.45rem 0", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ ...statSub, marginTop: 0 }}>{k}</span>
                <span style={{ fontSize: "0.95rem", textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        </FadeItem>
        <FadeItem>
          <div style={{ ...card, borderColor: TONE.hot }}>
            <div style={{ ...statSub, color: TONE.hot }}>21 August 2024</div>
            <div style={{ ...statLabel, fontWeight: 500, fontSize: "1.15rem" }}>
              Attacked in the Red Sea and set on fire
            </div>
            <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.9rem", lineHeight: 1.55 }}>
              The club paid nothing: the loss was a war risk, and war is excluded from a club&rsquo;s cover.
              The war risk underwriter carried all of it — and paid for a salvage that took 135 days,
              more than two hundred people and seven vessels.
            </div>
          </div>
        </FadeItem>
      </div>
      <div style={source}>Sources: incidents.json; insurance-market.json; Lloyd&rsquo;s List; Ambrey</div>
    </Slide>
  );
}
