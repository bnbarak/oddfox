// Typed access to the library. Every dataset is a plain JSON file in
// ../../data/json — imported at build time, so there is no fetch, no loading
// state and no offline bundle to keep in sync.
import manifest from "@data/manifest.json";
import seasats from "@data/companies/seasats.json";
import blacksea from "@data/companies/blacksea.json";
import customers from "@data/customers.json";
import gtm from "@data/gtm.json";
import incumbentClients from "@data/incumbent-clients.json";
import crmAccounts from "@data/crm/accounts.json";
import crmContacts from "@data/crm/contacts.json";
import crmSequences from "@data/crm/sequences.json";
import industryFleet from "@data/industry/fleet.json";
import industryRates from "@data/industry/rates.json";
import industryInsurance from "@data/industry/insurance.json";
import insuranceMarket from "@data/insurance-market.json";
import industryRoutes from "@data/industry/routes.json";
import unknowns from "@data/industry/unknowns.json";
import industryTrends from "@data/industry/trends.json";
import industryContainers from "@data/industry/containers.json";
import questions from "@data/industry/questions.json";
import attackedVessels from "@data/attacked-vessel-registry.json";
import vesselEconomics from "@data/industry/vessel-economics.json";
import riskQuant from "@data/industry/risk-quantification.json";
import statsLibrary from "@data/stats-library.json";
import vcDiligence from "@data/vc-diligence.json";
import sources from "@data/sources.json";
import ownershipModel from "@data/ownership-model.json";
import threatStats from "@data/threat-stats.json";
import incidents from "@data/incidents.json";
import chokepoints from "@data/chokepoints.json";
import flagStates from "@data/flag-states.json";
import operators from "@data/operators.json";
import riskEconomics from "@data/risk-economics.json";
import routeEconomics from "@data/route-economics.json";
import tactics from "@data/tactics.json";
import attackLog from "@data/attack-log.json";
import registries from "@data/registries.json";
import geoIncidents from "@data/geo-incidents.json";
import houthiTimeline from "@data/houthi-timeline.json";
import piracyHistory from "@data/piracy-history.json";
import marketPlayers from "@data/market-players.json";
import platforms from "@data/platforms.json";
import worldLand from "@data/world-land.json";

export const DB = {
  customers,
  gtm,
  incumbentClients,
  crmAccounts,
  crmContacts,
  crmSequences,
  industryFleet,
  industryRates,
  industryInsurance,
  insuranceMarket,
  industryRoutes,
  unknowns,
  industryTrends,
  industryContainers,
  questions,
  attackedVessels,
  vesselEconomics,
  riskQuant,
  statsLibrary,
  vcDiligence,
  /** One file per competitor under data/json/companies/. */
  dossiers: [seasats, blacksea],
  manifest, sources, ownershipModel, threatStats, incidents, chokepoints,
  flagStates, operators, riskEconomics, routeEconomics, tactics, attackLog,
  registries, geoIncidents, houthiTimeline, piracyHistory, marketPlayers,
  platforms, worldLand,
} as const;

export type Rec = Record<string, any>;

/* ---------- queries ---------- */

const srcIndex: Record<string, Rec> = Object.fromEntries(
  (sources.records as Rec[]).map((s) => [s.id, s]),
);
export const source = (id: string): Rec | undefined => srcIndex[id];

export const series = (id: string) =>
  (threatStats.series as Rec[]).find((s) => s.id === id);

export const point = (seriesId: string, period: string): number | null => {
  const s = series(seriesId) as { points?: { period: string; value: number }[] } | undefined;
  return s?.points?.find((p) => p.period === period)?.value ?? null;
};

export const breakdown = (id: string) =>
  (threatStats.breakdowns as Rec[]).find((b) => b.id === id);

export const companies = marketPlayers.records as Rec[];
export const atDistance = (n: number) => companies.filter((c) => c.proximity === n);
export const usvBuilders = companies.filter((c) => (c.builds as string[] | undefined)?.includes("usv"));
export const byMarket = (list: Rec[], m: string) => list.filter((c) => c.market === m);

export const pctChange = (from: number, to: number): number | null =>
  from ? Math.round(((to - from) / from) * 100) : null;

export function tally(items: Rec[], key: string | ((r: Rec) => string | undefined)) {
  const m: Record<string, number> = {};
  for (const it of items) {
    const k = typeof key === "function" ? key(it) : (it[key] as string | undefined);
    if (k == null) continue;
    m[k] = (m[k] ?? 0) + 1;
  }
  return Object.entries(m)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export const sum = (items: Rec[], key: string) =>
  items.reduce((a, it) => a + (Number(it[key]) || 0), 0);
