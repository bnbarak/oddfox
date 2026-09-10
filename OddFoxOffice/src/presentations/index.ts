import type { SlideMeta } from "../presentation/types";
import { slides as oddfoxSlides } from "./oddfox";
import { slides as insuranceSlides } from "./insurance";

export interface Presentation {
  id: string;
  title: string;
  slides: SlideMeta[];
  watermark?: string;
}

export const presentations: Presentation[] = [
  { id: "oddfox", title: "Where the gap is", slides: oddfoxSlides, watermark: "Internal" },
  { id: "insurance", title: "How insurance works", slides: insuranceSlides, watermark: "Internal" },
];

export const defaultPresentationId = "oddfox";

export function getPresentationFromHash(hash: string): Presentation {
  const id = hash.replace(/^#/, "").trim();
  return (
    presentations.find((p) => p.id === id) ??
    presentations.find((p) => p.id === defaultPresentationId)!
  );
}
