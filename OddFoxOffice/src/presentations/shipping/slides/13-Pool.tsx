import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title } from "../../../presentation/SlideText";
import { source } from "../../oddfox/slide-design-system";
import { ClubDiagram } from "../../shared/ClubDiagram";

export function PoolSlide() {
  return (
    <Slide align="start" tone="dim">
      <Eyebrow>13 — The Pool</Eyebrow>
      <Title>Past $10m, the claim is shared</Title>
      <ClubDiagram />
      <div style={source}>Source: International Group of P&amp;I Clubs, 2026/27 structure</div>
    </Slide>
  );
}
