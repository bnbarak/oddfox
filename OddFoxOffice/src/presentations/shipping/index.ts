import type { SlideMeta } from "../../presentation/types";
import { TitleSlide } from "./slides/01-Title";
import { OneShipSlide } from "./slides/02-OneShip";
import { FlagSlide } from "./slides/03-Flag";
import { OwnersSlide } from "./slides/04-Owners";
import { ManagersSlide } from "./slides/05-Managers";
import { CharterSlide } from "./slides/06-Charter";
import { MoneySlide } from "./slides/07-Money";
import { PartiesSlide } from "./slides/08-Parties";
import { CoversSlide } from "./slides/09-Covers";
import { ClubSlide } from "./slides/10-Club";
import { WhyClubsSlide } from "./slides/11-WhyClubs";
import { JoiningSlide } from "./slides/12-Joining";
import { PoolSlide } from "./slides/13-Pool";
import { TwelveClubsSlide } from "./slides/14-TwelveClubs";
import { NotInClubSlide } from "./slides/15-NotInClub";
import { OneShipThroughSlide } from "./slides/16-OneShipThrough";
import { WhyItMattersSlide } from "./slides/17-WhyItMatters";

/* The foundation deck. The insurance deck assumed its reader already knew
   what a club was, what a flag meant and who a charterer is; this one builds
   those first, one party at a time, then ends by walking a single real hull
   through all of them. Read this before "How insurance works". */
export const slides: SlideMeta[] = [
  { id: "title", title: "How shipping is built", kind: "title", Component: TitleSlide,
    notes: "The order matters: the ship, then who owns it, runs it and uses it, then insurance, then the club, then one ship end to end." },
  { id: "one-ship", title: "A ship is its own company", kind: "content", Component: OneShipSlide,
    notes: "The IMO number is the join key for everything in our library. Names match the wrong ship — our own Tutor lookup matched an unrelated vessel moving in the North Sea." },
  { id: "flag", title: "The flag", kind: "content", Component: FlagSlide,
    notes: "A flag is a legal choice, not a nationality. It decides whose law applies on board and whose certificates the ship carries. Most tonnage sits on open registries, so the flag tells you almost nothing about who to call." },
  { id: "owners", title: "Two owners", kind: "content", Component: OwnersSlide,
    notes: "The registered owner is usually a one-ship company with no staff. The beneficial owner — the family or group everyone actually names — is the one that signs a contract, and it is not in any free registry." },
  { id: "managers", title: "Who runs it", kind: "content", Component: ManagersSlide,
    notes: "The technical manager is who a master calls and is free to find, because it is named on the safety certificate. Three of the third-party managers named here are tier 1 accounts in our CRM." },
  { id: "charter", title: "Who uses it", kind: "content", Component: CharterSlide,
    notes: "Under a time or voyage charter the charterer pays the war risk premium. The party with the budget is often not the party that owns the ship — and in tankers and dry bulk the charterer is frequently the cargo owner itself." },
  { id: "money", title: "Where the money is", kind: "content", Component: MoneySlide,
    notes: "The countries that own the ships are not the countries that flag them. Follow the money, not the flag." },
  { id: "parties", title: "Nine parties, one hull", kind: "content", Component: PartiesSlide,
    notes: "Everything so far on one picture, plus the one party no ship registry records: the beneficial cargo owner. It belongs to the voyage rather than the vessel and changes every trip — the bill of lading names it. In tankers and dry bulk it is often the charterer itself. Two of the nine are insurers; neither buys security, but both price the risk." },
  { id: "covers", title: "Four covers, two owners", kind: "content", Component: CoversSlide,
    notes: "Hull insurance covers the ship against ordinary perils; war risk is struck out of it and bought back separately; the club covers liability to others. Those three are the shipowner's. Cargo insurance is the cargo owner's — and at 56.7% of global marine premium it is the largest line of all. A loss is denied at the seams between these covers far more often than outright." },
  { id: "club", title: "A club", kind: "content", Component: ClubSlide,
    notes: "This is the concept the whole insurance deck depends on. A club is a mutual: owned by the shipowners it insures, with no shareholders. Members pay calls rather than premiums, and a bad year brings a supplementary call." },
  { id: "why-clubs", title: "Why clubs exist", kind: "content", Component: WhyClubsSlide,
    notes: "They began as shipowners covering for each other what the commercial market would not. The four shown are the oldest still operating." },
  { id: "joining", title: "Joining", kind: "content", Component: JoiningSlide,
    notes: "Membership is per hull, so ask which club a ship is in, not which club an owner is in. A ship without club cover cannot legally or commercially trade." },
  { id: "pool", title: "The Pool", kind: "content", Component: PoolSlide,
    notes: "Under $10m your club pays alone. Between $10m and $100m all twelve share it. Above that the group's joint reinsurance pays, then a collective overspill, and above $3.35bn the clubs can invoice their own members. When one reinsurer missed the deadline on the Baltimore bridge settlement, all twelve clubs funded the shortfall so Britannia could pay on time." },
  { id: "twelve", title: "The twelve clubs", kind: "content", Component: TwelveClubsSlide,
    notes: "Tonnage bases differ slightly: Steamship's figure includes chartered tonnage, and West of England does not publish one. NorthStandard is the 2023 merger of North and the Standard Club, which is why older sources say thirteen." },
  { id: "outside", title: "Outside the clubs", kind: "content", Component: NotInClubSlide,
    notes: "Over 90% of shadow-fleet ships produce an insurance certificate when challenged, yet 36.5% of the tanker fleet has no cover anyone can verify. The gap is between a piece of paper and an insurer that would actually pay." },
  { id: "one-ship-through", title: "The Sounion", kind: "content", Component: OneShipThroughSlide,
    notes: "Being entered with a club tells you nothing about who pays for a missile. Gard was Sounion's club and paid nothing; Brit's Keel Consortium held all of the war cover and funded the salvage." },
  { id: "why-it-matters", title: "Why this matters to us", kind: "closing", Component: WhyItMattersSlide,
    notes: "Twelve organisations reach almost the whole legitimate fleet, and each has a financial motive to reduce its members' claims. Risk Intelligence proved the route: it sold to NorthStandard's loss-prevention head, and the club distributed it to its members." },
];
