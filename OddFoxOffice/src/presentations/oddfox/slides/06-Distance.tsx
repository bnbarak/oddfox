import { motion } from "framer-motion";
import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { fadeUp } from "../../../presentation/slideVariants";
import { companies, atDistance, players } from "../data";
import { source, TONE } from "../slide-design-system";

export function DistanceSlide() {
  const model = players.proximity_model as { scale: Record<string, string> };
  const bands = [4, 3, 2, 1, 0].map((n) => ({
    n,
    label: model.scale[String(n)],
    count: atDistance(n).length,
  }));
  const max = Math.max(...bands.map((b) => b.count), 1);
  const tone = (n: number) => (n === 4 ? TONE.calm : n === 3 ? TONE.hot : n === 2 ? TONE.warm : TONE.cool);
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>05 — Distance</Eyebrow>
      <Title>How close is anyone?</Title>
      <Body>
        Four axes, scored from the data, not assigned: does it escort, is it uncrewed, does
        it serve commercial customers, is the mission security?
      </Body>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
        {bands.map((b) => (
          <FadeItem key={b.n}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(210px,1fr) 3fr auto", gap: "1.25rem", alignItems: "center" }}>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", color: tone(b.n) }}>{b.n}/4</span>
                <span style={{ marginLeft: ".6rem" }}>{b.label}</span>
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,.08)", borderRadius: 1 }}>
                <motion.div
                  variants={fadeUp}
                  style={{ width: `${(b.count / max) * 100}%`, height: "100%", background: tone(b.n), borderRadius: 1 }}
                />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.4rem", minWidth: 48, textAlign: "right", color: tone(b.n) }}>
                {b.count}
              </div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Computed across all {companies.length} companies</div>
    </Slide>
  );
}
