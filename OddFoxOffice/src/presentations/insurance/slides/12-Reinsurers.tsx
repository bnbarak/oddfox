import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, FadeItem } from "../../../presentation/SlideText";
import { card, statLabel, statSub, source, TONE } from "../../oddfox/slide-design-system";

const EVENTS = [
  { d: "1 March 2026", h: "The Gulf", b: "Gard, Skuld, NorthStandard, London P&I and the American Club issue 72-hour cancellation notices for Iran and the Persian/Arabian Gulf. Cover reinstates instantly with a geographic exclusion.", t: TONE.warm },
  { d: "13 August 2026", h: "The southern Red Sea", b: "Six clubs withdraw fixed-premium and non-poolable war components across Bab el-Mandeb, the Gulf of Aden and the western Indian Ocean, pushing the line north to 25°30'N.", t: TONE.hot },
];

export function ReinsurersSlide() {
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>13 — Who really decides</Eyebrow>
      <Title>In 2026 the decision moved upstream, twice</Title>
      <div className="slide__grid slide__grid--2">
        {EVENTS.map((e) => (
          <FadeItem key={e.d}>
            <div style={card}>
              <div style={{ ...statSub, color: e.t }}>{e.d}</div>
              <div style={{ ...statLabel, fontWeight: 500, fontSize: "1.15rem" }}>{e.h}</div>
              <div style={{ ...statSub, textTransform: "none", letterSpacing: 0, marginTop: "0.8rem", lineHeight: 1.5 }}>{e.b}</div>
            </div>
          </FadeItem>
        ))}
      </div>
      <blockquote style={{ fontSize: "1.15rem", lineHeight: 1.55, borderLeft: `3px solid ${TONE.hot}`, paddingLeft: "1.3rem", margin: "1.6rem 0", maxWidth: "60ch" }}>
        &ldquo;Gard have today received Notice of Cancellation <em>from their reinsurers</em>… As a result,
        it is necessary for the Insurers to issue Notice of Cancellation.&rdquo;
      </blockquote>
      <div style={source}>Sources: Gard Member Circular 01/2026; S&amp;P Global; Splash247</div>
    </Slide>
  );
}
