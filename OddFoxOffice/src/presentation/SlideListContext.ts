import { createContext, useContext } from "react";
import type { SlideMeta } from "./types";

/**
 * Exposes the active deck's slide list to any slide that needs to read it
 * (e.g. a table-of-contents slide). Provided by `SlideDeck`.
 *
 * Slides that use this context stay independent of any specific deck — they
 * do NOT import from a deck's `index.ts` (which would be a circular dep).
 */
export const SlideListContext = createContext<SlideMeta[]>([]);

export function useSlideList(): SlideMeta[] {
  return useContext(SlideListContext);
}

/**
 * Exposes the index of the slide currently being rendered. Lets a slide read
 * its own position without hard-coding it in the slide file — e.g. so an
 * Eyebrow can render "03 — Title" and stay in sync when slides are reordered.
 */
export const SlidePositionContext = createContext<number | null>(null);

export function useSlidePosition(): number | null {
  return useContext(SlidePositionContext);
}

/**
 * Returns a zero-padded 1-indexed position string ("03") for the current
 * slide, or null if no position context is provided (e.g. SSR or preview).
 *
 * Numbering excludes title slides (cover / section dividers), the agenda,
 * and the appendix — so the first numbered slide is "01" and the sequence
 * matches the table of contents one-to-one.
 */
export function useSlideNumber(): string | null {
  const index = useContext(SlidePositionContext);
  const slides = useContext(SlideListContext);
  if (index === null) return null;
  const current = slides[index];
  if (!current) return null;
  if (!isNumbered(current)) return null;
  const position = slides.slice(0, index + 1).filter(isNumbered).length;
  return String(position).padStart(2, "0");
}

function isNumbered(s: SlideMeta): boolean {
  return s.id !== "agenda" && s.id !== "framing" && s.kind !== "appendix";
}
