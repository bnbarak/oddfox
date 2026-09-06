import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { platforms } from "../data";
import { source, TONE } from "../slide-design-system";

type P = {
  platform: string; maker: string; market: string;
  length_m?: number; max_speed_kn?: number; endurance?: string; range_nm?: number;
};

export function PlatformsSlide() {
  const recs = platforms.records as P[];
  const plotted = recs.filter((r) => r.max_speed_kn && r.endurance);
  const fast = recs.filter((r) => (r.max_speed_kn ?? 0) >= 35);
  const long = recs.filter((r) => /month|365|180/.test(r.endurance ?? ""));
  const both = fast.filter((r) => long.includes(r));
  const cov = platforms.spec_coverage as Record<string, number>;
  return (
    <Slide align="start" tone="default">
      <Eyebrow>06 — Platforms</Eyebrow>
      <Title>Fast or persistent. Not both.</Title>
      <Body>
        Of {cov.platforms} platforms with published specifications, {fast.length} do 35 knots
        or more and {long.length} stay out for months. {both.length === 0 ? "None do both." : `${both.length} do both.`}
      </Body>
      <div className="slide__grid">
        <FadeItem>
          <div style={{ padding: "1.5rem", border: `1px solid ${TONE.hot}`, borderRadius: 3 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: ".1em", textTransform: "uppercase", color: TONE.hot }}>
              Fast — 35 kn and above
            </div>
            {fast.slice(0, 6).map((r) => (
              <div key={r.platform} style={{ marginTop: ".6rem", fontSize: ".95rem" }}>
                {r.platform} <span style={{ color: "var(--color-fg-muted)" }}>{r.max_speed_kn} kn</span>
              </div>
            ))}
          </div>
        </FadeItem>
        <FadeItem>
          <div style={{ padding: "1.5rem", border: `1px solid ${TONE.calm}`, borderRadius: 3 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: ".1em", textTransform: "uppercase", color: TONE.calm }}>
              Persistent — months at sea
            </div>
            {long.slice(0, 6).map((r) => (
              <div key={r.platform} style={{ marginTop: ".6rem", fontSize: ".95rem" }}>
                {r.platform} <span style={{ color: "var(--color-fg-muted)" }}>{r.max_speed_kn} kn</span>
              </div>
            ))}
          </div>
        </FadeItem>
      </div>
      <Body>
        A merchant ship transits at 12 to 16 knots. Everything that stays out for months tops
        out below that, so it cannot keep station with the thing it is escorting.
      </Body>
      <div style={source}>
        {plotted.length} of {cov.platforms} publish both speed and endurance. Only{" "}
        {cov.range_nm} publish a range at all.
      </div>
    </Slide>
  );
}
