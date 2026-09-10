import type { SlideMeta } from "../../presentation/types";
import { TitleSlide } from "./slides/01-Title";
import { StackSlide } from "./slides/02-Stack";
import { CharterSlide } from "./slides/03-Charter";
import { CoverStackSlide } from "./slides/04-CoverStack";
import { HullAndWarSlide } from "./slides/05-HullAndWar";
import { PandISlide } from "./slides/06-PandI";
import { PoolSlide } from "./slides/06b-Pool";
import { HowPricedSlide } from "./slides/07-HowPriced";
import { JWCSlide } from "./slides/08-JWC";
import { RatesSlide } from "./slides/09-Rates";
import { SeamsSlide } from "./slides/10-Seams";
import { DeclinedSlide } from "./slides/11-Declined";
import { ReinsurersSlide } from "./slides/12-Reinsurers";
import { CaseLawSlide } from "./slides/13-CaseLaw";
import { UninsuredSlide } from "./slides/14-Uninsured";
import { MarketSlide } from "./slides/15-Market";
import { NotPricedSlide } from "./slides/16-NotPriced";
import { VerifiableSlide } from "./slides/17-Verifiable";
import { PrecedentSlide } from "./slides/18-Precedent";
import { CloseSlide } from "./slides/19-Close";

/* A reference deck rather than a pitch. It explains the machinery — the eight
   parties behind a hull, the eight covers over it, how a war risk premium is
   actually set, and where claims die. The last four slides are the part that
   bears on us, and they are deliberately the least flattering. */
export const slides: SlideMeta[] = [
  { id: "title", title: "How a ship gets insured", kind: "title", Component: TitleSlide,
    notes: "Reference deck. The point of the first half is that there is no single policy and no single owner." },
  { id: "stack", title: "Eight parties", kind: "content", Component: StackSlide,
    notes: "Eight parties sit behind one hull, and two of them are insurers. Before anyone argues about cover, they argue about who the assured actually is — which is why attributing a loss takes weeks." },
  { id: "charter", title: "Who pays", kind: "content", Component: CharterSlide,
    notes: "The charterer usually bears the war risk premium. We have one charterer account in the CRM." },
  { id: "cover-stack", title: "Eight covers", kind: "content", Component: CoverStackSlide },
  { id: "hull-war", title: "Hull does not answer a missile", kind: "content", Component: HullAndWarSlide,
    notes: "The hull policy strikes out war, strikes, terrorism and malicious acts. Those perils are bought back separately, by a different market. Everything interesting in the last three years lives in that buy-back." },
  { id: "p-and-i", title: "Protection and indemnity", kind: "content", Component: PandISlide,
    notes: "Claims above $10m are pooled; above $100m the group reinsures together. That is why one catastrophic loss does not bankrupt a single club." },
  { id: "pool", title: "The members are the club", kind: "content", Component: PoolSlide,
    notes: "A club is not a company you buy a policy from — it is the shipowners themselves, pooling their liabilities. This is the concept everything else rests on. A club is not a counterparty — the members are the club. Under $10m your club pays alone; between $10m and $100m all twelve share it through the Pool; above that the group's joint reinsurance, one of the largest placements in the world. Above $3.35bn the clubs can invoice their own members. Baltimore proved it works: when one reinsurer missed the deadline on the DALI settlement, all twelve clubs funded the shortfall so Britannia could pay on time. The practical consequence for us: preventing one member's claim protects eleven other balance sheets, which is why loss prevention is a funded function and not a courtesy." },
  { id: "how-priced", title: "How a premium is set", kind: "content", Component: HowPricedSlide,
    notes: "Note what is missing: there is no step where a safety measure earns a credit. The architecture is exclusion, then reinstatement for a price. There is no discount primitive anywhere in the wording. That is the whole problem." },
  { id: "jwc", title: "The Joint War Committee", kind: "quote", Component: JWCSlide },
  { id: "rates", title: "What it costs", kind: "content", Component: RatesSlide },
  { id: "seams", title: "Where claims die", kind: "content", Component: SeamsSlide },
  { id: "declined", title: "Eternity C", kind: "quote", Component: DeclinedSlide },
  { id: "reinsurers", title: "The reinsurers decide", kind: "content", Component: ReinsurersSlide,
    notes: "The clubs did not decide. Their reinsurers served notice on them, on 72 hours, and the clubs passed it through — so any model of who can withdraw cover has to start at the reinsurance layer. Read the scope precisely too: the mutual owned cover and the excess war reinsurance were untouched. 'P&I clubs cancelled war cover' was wrong; what went was the non-poolable layer, mainly chartered exposures. If asked who our customer is, this slide is the argument that it may be the reinsurance layer." },
  { id: "case-law", title: "The judgments", kind: "content", Component: CaseLawSlide,
    notes: "The question governing every Red Sea loss — whether a Houthi attack is an act of war, terrorism, or a malicious act — has never been decided. London and Singapore arbitration is confidential, so it may never surface publicly." },
  { id: "uninsured", title: "The other fleet", kind: "content", Component: UninsuredSlide },
  { id: "market", title: "The size of it", kind: "content", Component: MarketSlide,
    notes: "Note what the market does NOT publish: no global ranking of marine insurers by premium exists, and Lloyd's does not break out marine at all — it reports Marine, Aviation and Energy as one segment." },
  { id: "not-priced", title: "What is not priced", kind: "content", Component: NotPricedSlide,
    notes: "The only quantified war risk credit is for buying another policy and waiving subrogation — not for making the ship safer. It works because another insurer's balance sheet absorbs part of the loss. Aon, three months later, flatly contradicts the fourth row: the war market 'does not pay attention to a vessel's state of preparedness'. The famous 30-40% figures come from a cost model sourced to anonymous contacts whose own citations disagree by a factor of two. Do not skip this slide in front of an underwriter — claiming a 40% discount is how we lose the room." },
  { id: "verifiable", title: "Verifiability", kind: "content", Component: VerifiableSlide,
    notes: "It is not that underwriters doubt an escort works — it is that they have no way to know it was there. Every credit in the record attaches to something the assured cannot misreport. Shipping solved this once already for a condition that varies by voyage: freeboard changes with loading, so the industry painted the load line on every hull to a surveyed standard and put draught in a public broadcast." },
  { id: "precedent", title: "Everyone who tried", kind: "content", Component: PrecedentSlide,
    notes: "The Convoy Escort Programme existed BECAUSE insurers did not want to give discounts — the plan was to run the fleet themselves and keep the margin, and they could not execute it. The competitor that beat them is still here: free naval escort. EUNAVFOR Aspides has accompanied over 2,240 merchant vessels, with protection requests up 39% in five months of 2026." },
  { id: "close", title: "The honest close", kind: "closing", Component: CloseSlide,
    notes: "One caution for any negotiation: when a club grants a discount for a precaution, Hellenic War Risks says it 'enshrines' that precaution into the terms of cover. The discount you win becomes the warranty you must never breach." },
];
