// Single place where this deck touches the library. Slides import from here,
// so if a dataset moves the blast radius is one file.
import own from "@data/ownership-model.json";
import flags from "@data/flag-states.json";
import ins from "@data/insurance-market.json";
import incidents from "@data/incidents.json";

export { own, flags, ins };

type Rec = Record<string, any>;

export const party = (id: string) => (own.records as Rec[]).find((r) => r.id === id)!;
export const layer = (id: string) => (ins.layers as Rec[]).find((l) => l.id === id)!;
export const vessel = (id: string) => (ins.vessel_cover as Rec[]).find((v) => v.id === id)!;
export const figure = (id: string) =>
  ((ins.market as Rec).figures as Rec[]).find((f) => f.id === id)!;
export const incident = (id: string) =>
  (((incidents as Rec).records ?? (incidents as Rec).incidents) as Rec[]).find((r) => r.id === id)!;

/** The twelve International Group clubs, largest first. The market-body record
    for the Group itself is kind "market-body", so it drops out here. */
export const clubs = () =>
  (ins.underwriters as Rec[])
    .filter((u) => u.kind === "p-and-i-club" && u.international_group)
    .sort((a, b) => (b.tonnage_gt_m ?? -1) - (a.tonnage_gt_m ?? -1));
