import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { companies } from "../data";
import { source, TONE } from "../slide-design-system";

export function PositioningSlide() {
  const withHead = companies.filter((c) => c.headline) as { name: string; headline: string; market: string }[];
  const withProof = companies.filter((c) => (c.proof_points as string[] | undefined)?.length);
  const pricing = companies.filter((c) => c.publishes_pricing === true);
  const specs = companies.filter((c) => c.publishes_specs === true);
  return (
    <Slide align="start" tone="default">
      <Eyebrow>08 — How they sell it</Eyebrow>
      <Title>Everyone leads with reach. Nobody prices.</Title>
      <Body>
        Read off {withProof.length} company websites: the proof point is always scale — vessels
        covered, transits protected, hours on station.
      </Body>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem", marginTop: "1rem" }}>
        {withHead.slice(0, 4).map((c) => (
          <FadeItem key={c.name}>
            <div style={{ borderLeft: `2px solid ${c.market === "military" ? TONE.hot : TONE.calm}`, paddingLeft: "1.1rem" }}>
              <div style={{ fontSize: "1.05rem", lineHeight: 1.45 }}>&ldquo;{c.headline}&rdquo;</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: ".7rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-fg-muted)", marginTop: ".35rem" }}>
                {c.name}
              </div>
            </div>
          </FadeItem>
        ))}
      </div>

      <div className="slide__grid" style={{ marginTop: "1.5rem" }}>
        <FadeItem>
          <div style={{ padding: "1.25rem", border: "1px solid var(--color-border)", borderRadius: 3 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "2rem", color: TONE.calm }}>{specs.length}</div>
            <div style={{ marginTop: ".4rem" }}>publish technical specifications</div>
          </div>
        </FadeItem>
        <FadeItem>
          <div style={{ padding: "1.25rem", border: `1px solid ${TONE.hot}`, borderRadius: 3 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "2rem", color: TONE.hot }}>{pricing.length}</div>
            <div style={{ marginTop: ".4rem" }}>publish any pricing</div>
          </div>
        </FadeItem>
        <FadeItem>
          <div style={{ padding: "1.25rem", border: "1px solid var(--color-border)", borderRadius: 3 }}>
            <div style={{ fontSize: ".95rem", lineHeight: 1.5 }}>
              Ambrey states <strong>23,344 vessels supported</strong>. MAST states{" "}
              <strong>8,000+ transits protected</strong>. Both are reach, not outcome.
            </div>
          </div>
        </FadeItem>
      </div>

      <div style={source}>
        Read from company homepages and about pages, 3 September 2026. Not one of the 16 sampled publishes a price.
      </div>
    </Slide>
  );
}
