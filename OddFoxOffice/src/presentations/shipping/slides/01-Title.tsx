import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Subtitle, Body } from "../../../presentation/SlideText";
import { source } from "../../oddfox/slide-design-system";

export function TitleSlide() {
  return (
    <Slide align="center" tone="accent">
      <Eyebrow>Seaworth — reference deck</Eyebrow>
      <Title>How shipping is built</Title>
      <Subtitle>Who owns a ship, who runs it, who uses it — and the clubs underneath all of it.</Subtitle>
      <Body>
        Start here, before the insurance deck. Every term is defined on the slide where it first
        appears.
      </Body>
      <div style={source}>Built from ownership-model.json, flag-states.json and insurance-market.json</div>
    </Slide>
  );
}
