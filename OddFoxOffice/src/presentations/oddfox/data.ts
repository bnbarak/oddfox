// Single place where the deck touches the library. Slides import from here,
// so if a dataset moves the blast radius is one file.
import threat from "@data/threat-stats.json";
import history from "@data/piracy-history.json";
import players from "@data/market-players.json";
import platforms from "@data/platforms.json";
import risk from "@data/risk-economics.json";
import attackLog from "@data/attack-log.json";
import tactics from "@data/tactics.json";
import manifest from "@data/manifest.json";

export { threat, history, players, platforms, risk, attackLog, tactics, manifest };

type Rec = Record<string, unknown>;

export const point = (seriesId: string, period: string): number | null => {
  const s = (threat.series as Rec[]).find((x) => x.id === seriesId) as
    | { points: { period: string; value: number }[] }
    | undefined;
  return s?.points.find((p) => p.period === period)?.value ?? null;
};

export const companies = players.records as Rec[];
export const atDistance = (n: number) => companies.filter((c) => c.proximity === n);
export const usvBuilders = companies.filter((c) =>
  (c.builds as string[] | undefined)?.includes("usv"),
);
export const byMarket = (list: Rec[], m: string) => list.filter((c) => c.market === m);

export const pct = (from: number, to: number) => Math.round(((to - from) / from) * 100);
