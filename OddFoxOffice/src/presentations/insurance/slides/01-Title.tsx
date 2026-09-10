import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Subtitle, Body } from "../../../presentation/SlideText";
import { source } from "../../oddfox/slide-design-system";

export function TitleSlide() {
  return (
    <Slide align="center" tone="accent">
      <Eyebrow>Seaworth — reference deck</Eyebrow>
      <Title>How a ship gets insured</Title>
      <Subtitle>
        And why, when a missile hits one, it is rarely obvious who pays.
      </Subtitle>
      <Body>
        Marine insurance is not one policy. It is a stack of separate covers, written by
        separate parties, under separate contracts. A loss is denied at the seam between two
        layers far more often than it is denied outright.
      </Body>
      <div style={source}>Every figure in this deck carries a source in insurance-market.json</div>
    </Slide>
  );
}
