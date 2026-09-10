import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body, FadeItem } from "../../../presentation/SlideText";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const ROLES = [
  { h: "Technical manager", tag: "runs it", t: TONE.cool,
    b: "Runs the ship day to day — hires the crew, keeps it maintained, keeps it in class and compliant with its flag. It holds the ship's safety management certificate, so it is named in public records. The master calls this office." },
  { h: "Commercial manager", tag: "trades it", t: TONE.warm,
    b: "Sells the ship's carrying capacity — fixes it on charters and decides where it trades. Whether a ship goes through Bab el-Mandeb or round the Cape is decided here." },
  { h: "In-house or hired", tag: "often a third party", t: TONE.calm,
    b: "Large owners run their own ships. Many hire a manager instead — Anglo-Eastern, V.Group, Bernhard Schulte, Columbia — which may run hundreds of ships for dozens of owners." },
];

export function ManagersSlide() {
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>05 — Who runs it</Eyebrow>
      <Title>Who runs it, and who decides where it goes</Title>
      <Body>Routing decisions are commercial decisions, not operational ones.</Body>
      <div className="slide__grid">
        {ROLES.map((r) => (
          <FadeItem key={r.h}>
            <div style={card}>
              <div style={{ ...statSub, color: r.t }}>{r.tag}</div>
              <div style={{ ...statLabel, fontWeight: 500 }}>{r.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.7rem", lineHeight: 1.5 }}>{r.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <div style={source}>Source: ownership-model.json</div>
    </Slide>
  );
}
