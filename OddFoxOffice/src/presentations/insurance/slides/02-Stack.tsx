import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, FadeItem } from "../../../presentation/SlideText";
import { own } from "../data";
import { card, statLabel, statSub, source } from "../../oddfox/slide-design-system";

export function StackSlide() {
  const parties = own.records as { id: string; role: string; what?: string }[];
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>02 — Before the insurance</Eyebrow>
      <Title>There is no such thing as &ldquo;the shipowner&rdquo;</Title>
      <div className="slide__grid slide__grid--4">
        {parties.map((p, i) => (
          <FadeItem key={p.id}>
            <div style={card}>
              <div style={statSub}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ ...statLabel, fontWeight: 500 }}>{p.role}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: ownership-model.json</div>
    </Slide>
  );
}
