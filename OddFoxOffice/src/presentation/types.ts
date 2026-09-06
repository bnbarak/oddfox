import type { ComponentType } from "react";

export type SlideKind =
  | "title"
  | "section"
  | "content"
  | "quote"
  | "closing"
  | "appendix";

export interface SlideMeta {
  id: string;
  title: string;
  kind: SlideKind;
  Component: ComponentType;
  notes?: string;
}
