// Single place where this deck touches the library. Slides import from here,
// so if a dataset moves the blast radius is one file.
import ins from "@data/insurance-market.json";
import own from "@data/ownership-model.json";
import risk from "@data/risk-economics.json";

export { ins, own, risk };

type Rec = Record<string, any>;

export const layer = (id: string) => (ins.layers as Rec[]).find((l) => l.id === id)!;
export const vessel = (id: string) => (ins.vessel_cover as Rec[]).find((v) => v.id === id)!;
export const denial = (id: string) => (ins.denials as Rec[]).find((d) => d.id === id)!;
export const figure = (id: string) =>
  ((ins.market as Rec).figures as Rec[]).find((f) => f.id === id)!;
export const party = (id: string) => (own.records as Rec[]).find((r) => r.id === id)!;
export const charter = (id: string) => (own.charter_types as Rec[]).find((c) => c.id === id)!;

/** Underwriters seen on a named hull, for the "who was actually on it" slides. */
export const coverOn = (vesselId: string) => (vessel(vesselId).cover ?? []) as Rec[];
