import { Slide } from "../../../presentation/Slide";
import { Eyebrow, Title, Body } from "../../../presentation/SlideText";
import { source, TONE } from "../../oddfox/slide-design-system";

export function DeclinedSlide() {
  return (
    <Slide align="center" tone="accent">
      <Eyebrow>12 — The other outcome</Eyebrow>
      <Title>The underwriter can simply say no</Title>
      <Body>
        Eternity C, a bulk carrier, held an annual war risk policy with the insurer Travelers. Entering a listed area requires
        notice, and the underwriter may charge more — or decline. Travelers declined the final
        voyage.
      </Body>
      <blockquote style={{ fontSize: "1.3rem", lineHeight: 1.5, borderLeft: `3px solid ${TONE.hot}`, paddingLeft: "1.4rem", margin: "2rem 0", maxWidth: "46ch" }}>
        The vessel sailed uninsured, was sunk the next day, and roughly $20m fell entirely on the
        owner. Four crew were killed.
      </blockquote>
      <Body>
        Lloyd&rsquo;s List called the decision unusual, with no publicly known precedent in either
        the Black Sea or Red Sea conflicts. Eternity C had no direct Israeli link — the operator&rsquo;s
        other ships had merely called at Israeli ports. That is affiliation risk reaching two
        degrees out.
      </Body>
      <div style={source}>Sources: Financial Times; Lloyd&rsquo;s List</div>
    </Slide>
  );
}
