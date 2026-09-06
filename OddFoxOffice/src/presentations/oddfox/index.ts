import type { SlideMeta } from "../../presentation/types";
import { TitleSlide } from "./slides/01-Title";
import { ThreatSlide } from "./slides/02-Threat";
import { WhoGetsHitSlide } from "./slides/03-WhoGetsHit";
import { CostSlide } from "./slides/04-Cost";
import { FieldSlide } from "./slides/05-Field";
import { DistanceSlide } from "./slides/06-Distance";
import { SameAxisSlide } from "./slides/07-SameAxis";
import { PlatformsSlide } from "./slides/08-Platforms";
import { MoneySlide } from "./slides/09-Money";
import { PositioningSlide } from "./slides/10-Positioning";
import { HonestSlide } from "./slides/11-Honest";
import { CloseSlide } from "./slides/12-Close";

export const slides: SlideMeta[] = [
  {
    id: "title", kind: "title", title: "Where the gap is", Component: TitleSlide,
    notes: `Everything in this deck is read live from the data library. No number is typed into a slide. If a dataset changes, the deck changes.`,
  },
  {
    id: "threat", kind: "content", title: "Fewer attacks, not less risk", Component: ThreatSlide,
    notes: `The trap: H1 2026 was the lowest half-year count since 1992. But perpetrators still succeeded 84% of the time, and 67 crew were taken hostage from 38 incidents — more than from all 137 incidents of 2025. Never price on incident counts.`,
  },
  {
    id: "who", kind: "content", title: "Who gets hit", Component: WhoGetsHitSlide,
    notes: `Bulk carriers and product tankers, not container ships. And close inshore — median 10.1 km. That is a real constraint: much of this happens inside territorial water where an escort has jurisdictional problems.`,
  },
  {
    id: "cost", kind: "content", title: "What risk costs", Component: CostSlide,
    notes: `War risk premium is the only maritime risk figure already sitting on a voyage budget. Under most time and voyage charters the charterer bears it — which is why the charterer, not the owner, often holds the money.`,
  },
  {
    id: "field", kind: "content", title: "The field", Component: FieldSlide,
    notes: `123 companies across 36 countries. Note the last stat: six commercial-only USV builders, and every one of them does survey or ocean data, not security.`,
  },
  {
    id: "distance", kind: "content", title: "Distance", Component: DistanceSlide,
    notes: `The four axes are computed from the categories, builds and market fields — not assigned by hand. One company scores 4 of 4: Seasats, whose site names HVU escort and harbour security (verified 3 September 2026).`,
  },
  {
    id: "same-axis", kind: "quote", title: "All 21 miss the same one", Component: SameAxisSlide,
    notes: `The 21 at 3/4 all miss the same axis: uncrewed. That is still the shape of the field. But it is no longer an empty box — Seasats sits at 4/4 on its own published missions, so treat it as the named competitor, not a hypothetical.`,
  },
  {
    id: "platforms", kind: "content", title: "Platforms", Component: PlatformsSlide,
    notes: `The engineering constraint. Merchant ships transit at 12-16 knots. Persistent platforms cruise at 2-5. Seasats Heavyfish is the only platform of 39 whose maker names high-value-unit escort as an intended mission.`,
  },
  {
    id: "money", kind: "content", title: "Where the capital is going", Component: MoneySlide,
    notes: `The ratio is the argument. HavocAI raised ~$200m in two years for military autonomy. Sea Machines, the only company here selling autonomy to a commercial shipping line, has raised about $30m in nine years. Investors are funding the navy buyer, not the shipowner. That is either a warning or the opportunity, depending on whether you think the shipowner budget is real — and the war-risk premium slide says it is.`,
  },
  {
    id: "positioning", kind: "content", title: "How they sell it", Component: PositioningSlide,
    notes: `Read straight off their websites. Everyone leads with reach — vessels covered, transits protected. Nobody publishes a price, which means there is no anchor in the market and the first credible published number sets it. Note Saildrone's own headline now says "kinetic effects" — they have moved from sensing into weapons.`,
  },
  {
    id: "honest", kind: "content", title: "What cuts against us", Component: HonestSlide,
    notes: `Put this in front of an investor before they find it themselves. The Maersk Yorktown point is the strongest and the most honest: escort changes the outcome, not the odds.`,
  },
  {
    id: "close", kind: "closing", title: "The gap is one axis wide", Component: CloseSlide,
    notes: `Close on the open questions, not on a claim. The three named here are the ones that would most change the picture if answered.`,
  },
];
