import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { companies } from "../data";
import { source, TONE } from "../slide-design-system";

type Row = { name: string; when: string; what: string; tone: string };

// Rounds and listings, newest first. Every line traces to a record in
// market-players.json; the deck does not carry numbers of its own.
const funded = (id: string) => companies.find((c) => c.id === id) as Record<string, string> | undefined;

const raises: Row[] = [
  { name: "HavocAI", when: "founded 2024", what: funded("havocai")?.funding ?? "", tone: TONE.hot },
  { name: "ICEYE", when: "founded 2014", what: funded("iceye")?.funding ?? "", tone: TONE.warm },
  { name: "HawkEye 360", when: "founded 2015", what: funded("hawkeye360")?.funding ?? "", tone: TONE.warm },
  { name: "Maritime Robotics", when: "Jun 2026", what: funded("maritime-robotics")?.funding ?? "", tone: TONE.cool },
  { name: "Seasats", when: "Feb 2026", what: funded("seasats")?.funding ?? "", tone: TONE.cool },
  { name: "Sea Machines", when: "since 2017", what: funded("sea-machines")?.funding ?? "", tone: TONE.calm },
];

const consolidation = [
  "AEVEX is acquiring BlackSea Technologies for up to $650m",
  "Kpler bought Spire Maritime for $241m, after MarineTraffic and FleetMon",
  "FTV Capital took Windward private off the London Stock Exchange",
  "Solace Global is now a Global Guardian company",
  "Ocean Infinity acquired MMT; Dryad combined with IMSA",
];

export function MoneySlide() {
  const listed = companies.filter((c) => typeof c.public_listing === "string" && /listed/i.test(c.public_listing as string));
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>07 — Startups, tech and money</Eyebrow>
      <Title>Where the capital is going</Title>
      <Body>
        Into military autonomy and into data. Not into commercial escort.
      </Body>

      <div className="slide__grid">
        <FadeItem>
          <div style={{ padding: "1.5rem", border: "1px solid var(--color-border)", borderRadius: 3 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: ".68rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-fg-muted)", marginBottom: "1rem" }}>
              Disclosed raises
            </div>
            {raises.filter((r) => r.what).map((r) => (
              <div key={r.name} style={{ padding: ".55rem 0", borderBottom: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <span style={{ fontWeight: 700, color: r.tone }}>{r.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: ".72rem", color: "var(--color-fg-muted)" }}>{r.when}</span>
                </div>
                <div style={{ fontSize: ".88rem", color: "var(--color-fg-muted)", marginTop: ".2rem", lineHeight: 1.45 }}>{r.what}</div>
              </div>
            ))}
          </div>
        </FadeItem>

        <FadeItem>
          <div style={{ padding: "1.5rem", border: "1px solid var(--color-border)", borderRadius: 3 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: ".68rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-fg-muted)", marginBottom: "1rem" }}>
              The sector is consolidating
            </div>
            {consolidation.map((c) => (
              <div key={c} style={{ padding: ".55rem 0", borderBottom: "1px solid var(--color-border)", fontSize: ".92rem", lineHeight: 1.5 }}>
                {c}
              </div>
            ))}
            <div style={{ marginTop: "1rem", fontSize: ".88rem", color: "var(--color-fg-muted)" }}>
              {listed.length} of the {companies.length} are publicly listed — DroneShield on the ASX, Genasys and Red Cat on Nasdaq, Exail on Euronext.
            </div>
          </div>
        </FadeItem>
      </div>

      <Body>
        HavocAI raised roughly $200m in two years and Saronic took a $392m Navy award. Sea
        Machines, the one selling autonomy to a commercial shipping line, has raised about $30m
        in nine years. That ratio is the market telling you where it believes the buyer is.
      </Body>

      <div style={source}>
        Funding and listing figures as disclosed by the company or its press. Retrieved 2026-09-03.
      </div>
    </Slide>
  );
}
