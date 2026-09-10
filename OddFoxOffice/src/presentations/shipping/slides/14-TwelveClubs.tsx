import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, FadeItem } from "../../../presentation/SlideText";
import { clubs, figure } from "../data";
import { statSub, source, TONE } from "../../oddfox/slide-design-system";

export function TwelveClubsSlide() {
  const list = clubs();
  const share = figure("ig-tonnage-share");
  const max = Math.max(...list.map((c) => c.tonnage_gt_m ?? 0));
  return (
    <Slide align="start">
      <Eyebrow>14 — The twelve</Eyebrow>
      <Title>Twelve clubs cover {share.value}% of the world&rsquo;s ocean-going tonnage</Title>
      <div style={{ ...statSub, marginTop: "1.2rem" }}>
        Tonnage entered, millions — a measure of ships&rsquo; internal volume, not their weight
      </div>
      {/* Column-major, so reading down the left column is the six largest. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "repeat(6, auto)",
                    gridAutoFlow: "column", columnGap: "3rem", rowGap: "0.7rem", marginTop: "0.9rem" }}>
        {list.map((c) => (
          <FadeItem key={c.id}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "0.95rem" }}>{c.name}</span>
                <span style={{ ...statSub, marginTop: 0 }}>
                  {c.tonnage_gt_m != null ? `${c.tonnage_gt_m}m` : "not published"}
                </span>
              </div>
              <div style={{ height: 5, marginTop: 5, background: "var(--color-border)", borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${((c.tonnage_gt_m ?? 0) / max) * 100}%`,
                              background: TONE.cool, borderRadius: 2 }} />
              </div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Sources: International Group of P&amp;I Clubs; club annual reports. Bases differ slightly between clubs.</div>
    </Slide>
  );
}
