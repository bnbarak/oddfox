import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Subtitle, FadeItem } from "../../../presentation/SlideText";
import { atDistance, usvBuilders, byMarket } from "../data";
import { source, TONE } from "../slide-design-system";

export function CloseSlide() {
  return (
    <Slide align="center" tone="default">
      <Eyebrow>Close</Eyebrow>
      <Title>The gap is one axis wide</Title>
      <Subtitle>
        {atDistance(3).length} companies escort commercial ships against a security threat, all with crews.{" "}
        {usvBuilders.length} companies build uncrewed vessels, and the{" "}
        {byMarket(usvBuilders, "commercial").length} commercial ones do survey work.
      </Subtitle>
      <FadeItem>
        <div
          style={{
            marginTop: "2.5rem",
            fontSize: "clamp(1.1rem, 2vw, 1.5rem)",
            color: TONE.calm,
            maxWidth: "46ch",
            lineHeight: 1.5,
          }}
        >
          Nobody has put the two together.
        </div>
      </FadeItem>
      <div style={source}>
        Open questions the library cannot answer yet: what a 2026 armed-guard transit costs,
        whether an underwriter will discount for an escort, and what happened to Convoy Escort
        Programme Ltd.
      </div>
    </Slide>
  );
}
