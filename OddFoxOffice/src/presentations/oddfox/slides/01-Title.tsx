import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Subtitle } from "../../../presentation/SlideText";
import { manifest, companies, platforms } from "../data";
import { source } from "../slide-design-system";

export function TitleSlide() {
  return (
    <Slide align="start" tone="default">
      <Eyebrow>Seaworth — business context</Eyebrow>
      <Title>Where the gap is</Title>
      <Subtitle>
        What the attack record, the money and {companies.length} companies say about
        uncrewed escort for commercial shipping.
      </Subtitle>
      <div style={source}>
        Built from the Seaworth data library v{manifest.version} · {manifest.datasets.length} datasets ·{" "}
        {platforms.records.length} platform specifications · retrieved {manifest.retrieved}
      </div>
    </Slide>
  );
}
