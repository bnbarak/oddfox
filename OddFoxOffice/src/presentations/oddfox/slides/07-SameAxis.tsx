import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Subtitle, FadeItem } from "../../../presentation/SlideText";
import { atDistance } from "../data";
import { source, TONE } from "../slide-design-system";

export function SameAxisSlide() {
  const three = atDistance(3);
  const missing = new Set(
    three.map((c) => {
      const ax = c.proximity_axes as Record<string, boolean>;
      return Object.keys(ax).filter((k) => !ax[k])[0];
    }),
  );
  const only = missing.size === 1 ? [...missing][0] : null;
  return (
    <Slide align="center" tone="accent">
      <Eyebrow>05 — Distance</Eyebrow>
      <Title>
        All {three.length} miss the same one
      </Title>
      <Subtitle>
        Every company that comes closest escorts commercial ships against a security threat.
        Every one of them does it with a crew.
      </Subtitle>
      <FadeItem>
        <div
          style={{
            marginTop: "2.5rem",
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(2.5rem, 7vw, 5rem)",
            letterSpacing: "-0.05em",
            color: TONE.hot,
          }}
        >
          {only ?? "mixed"}
        </div>
        <div style={{ color: "var(--color-fg-muted)", marginTop: ".75rem" }}>
          the single axis missing from all of them
        </div>
      </FadeItem>
      <div style={source}>
        {three
          .slice(0, 8)
          .map((c) => c.name)
          .join(" · ")}
        {three.length > 8 ? ` · and ${three.length - 8} more` : ""}
      </div>
    </Slide>
  );
}
