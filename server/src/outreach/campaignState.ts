import type { Campaign, SendRecord } from "./schemas.js";

/* What is happening to an account, in one word.

   "Is this campaign running" is not one question. An account can be in a
   campaign nobody switched on, in one that is on but has never been written
   to, in one with mail sitting in the queue, or in one that has already
   landed — and those four call for completely different actions. Collapsing
   them into a boolean is what makes a CRM lie to you.

   One function, used by every surface that shows this, so the account page
   and the outreach table can never disagree about the same account. */

export type CampaignState = "none" | "paused" | "not started" | "queued" | "running";

export type AccountCampaign = {
  state: CampaignState;
  campaign_id: string | null;
  campaign_name: string | null;
};

const PENDING = new Set(["scheduled", "draft"]);
export const LANDED = new Set(["sent", "delivered", "opened", "clicked", "bounced", "complained"]);

export function stateFor(
  accountId: string, campaigns: Campaign[], sends: SendRecord[],
): AccountCampaign {
  const mine = campaigns.filter((c) => c.account_ids.includes(accountId));
  if (mine.length === 0) return { state: "none", campaign_id: null, campaign_name: null };

  // An active campaign wins over a paused one: being in both means somebody
  // started a second push, and the live one is the answer to "what now".
  const c = mine.find((x) => x.active) ?? mine[0]!;
  const named = { campaign_id: c.id, campaign_name: c.name };
  if (!c.active) return { state: "paused", ...named };

  // This campaign's own sends, not every message ever sent to the account.
  // Keyed on the campaign so a fresh campaign reads "not started" even where
  // an earlier one has already run against the same company.
  const live = sends.filter((s) => s.campaign_id === c.id && s.status !== "canceled");
  // Queued outranks running on purpose: something is about to go out, and
  // that is the fact that changes what you do in the next ten minutes.
  if (live.some((s) => PENDING.has(s.status))) return { state: "queued", ...named };
  if (live.some((s) => !s.dry_run && LANDED.has(s.status))) return { state: "running", ...named };
  return { state: "not started", ...named };
}

/** Every account's state in one pass, for the tables. */
export function statesFor(
  accountIds: string[], campaigns: Campaign[], sends: SendRecord[],
): Record<string, AccountCampaign> {
  return Object.fromEntries(accountIds.map((id) => [id, stateFor(id, campaigns, sends)]));
}
