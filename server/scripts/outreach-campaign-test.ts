/* Proves campaigns are independent of one another.

   They were not. Nothing on a send recorded which campaign produced it, so
   every reader matched on the account instead — and once two campaigns can
   name the same company, "this campaign contains that account" stops meaning
   "this campaign sent that message". The symptoms were all one bug:

     - a campaign created this morning reported yesterday's sends as its own
     - two campaigns on one account each claimed the same message
     - activating a second campaign skipped everybody the first had written
       to, so it queued nothing and looked like it had already run
     - a round 2 could be written against a thread the reader never saw

   The last two are the ones that change what actually gets sent, which is
   why they are tested here rather than left to the panels.

   Pure functions only — no Firestore, no model, no network:
     npx tsx scripts/outreach-campaign-test.ts
*/
import { due } from "../src/outreach/tick.js";
import { stateFor } from "../src/outreach/campaignState.js";
import { OutreachConfig, type Campaign, type SendRecord } from "../src/outreach/schemas.js";

let failed = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  // eslint-disable-next-line no-console
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failed++;
};

const cfg = OutreachConfig.parse({ cadence_days: { round_2: 4, round_3: 7 } });

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const send = (over: Partial<SendRecord>): SendRecord => ({
  id: Math.random().toString(36).slice(2),
  account_id: "acme", contact_id: "ana", campaign_id: null, company: "Acme",
  to: "ana@acme.com", from_domain: "seaworth.io", from_address: "b@seaworth.io",
  reply_to: null, round: 1, subject: "s", body: "b", html: null,
  template_tier: 1, written_by: "template", resend_id: "re_1", message_id: null,
  status: "delivered", last_event: null,
  scheduled_at: ago(10), quota_day: null, created_at: ago(10), updated_at: ago(10),
  dry_run: false, error: null,
  ...over,
});

const campaign = (over: Partial<Campaign>): Campaign => ({
  id: "c1", name: "C1", persona: "p", template_tier: 1, account_ids: ["acme"],
  active: true, created_at: ago(30), deleted_at: null,
  ...over,
});

// ---- the cadence is per campaign, not per person -----------------------

/* The headline case. Campaign A wrote to Ana ten days ago. Campaign B is new
   and has written to her never. B is owed a round 1 of its own; it must not
   inherit A's round 1 and jump straight to a round 2. */
const aRound1 = send({ campaign_id: "camp-a", round: 1, scheduled_at: ago(10), created_at: ago(10) });

const owed = due(cfg, [aRound1], []);
ok("one campaign's landed round 1 owes that campaign a round 2",
   owed.length === 1 && owed[0]!.next_round === 2 && owed[0]!.campaign_id === "camp-a",
   JSON.stringify(owed));

/* Campaign B's own round 1, sent today. A is owed a round 2 (10 days) and B
   is owed nothing yet (0 days). The two cadences run independently. */
const bRound1 = send({ campaign_id: "camp-b", round: 1, scheduled_at: ago(0), created_at: ago(0) });
const both = due(cfg, [aRound1, bRound1], []);
ok("two campaigns to one person keep separate cadences",
   both.length === 1 && both[0]!.campaign_id === "camp-a", JSON.stringify(both));

/* And a round 2 already written for A does not satisfy B. */
const aRound2 = send({ campaign_id: "camp-a", round: 2, scheduled_at: ago(1), created_at: ago(1),
                       status: "scheduled" });
const bOld = send({ campaign_id: "camp-b", round: 1, scheduled_at: ago(9), created_at: ago(9) });
const three = due(cfg, [aRound1, aRound2, bOld], []);
ok("a round 2 in one campaign does not satisfy another's",
   three.length === 1 && three[0]!.campaign_id === "camp-b" && three[0]!.next_round === 2,
   JSON.stringify(three));

/* A reply is a fact about the person, not the campaign: somebody who wrote
   back to one message must not keep getting another campaign's follow-ups. */
const answered = due(cfg, [aRound1, bOld], [{ contact_id: "ana", automated: false }]);
ok("a reply stops every campaign's follow-ups, not just the one answered",
   answered.length === 0, JSON.stringify(answered));

ok("an out-of-office stops nothing",
   due(cfg, [aRound1], [{ contact_id: "ana", automated: true }]).length === 1);

// A hand-written one-off belongs to no campaign and starts no cadence.
ok("round 0 never owes a follow-up",
   due(cfg, [send({ round: 0, campaign_id: null })], []).length === 0);

// ---- the state badge reads its own campaign ----------------------------

const campA = campaign({ id: "camp-a", name: "A" });
const campB = campaign({ id: "camp-b", name: "B" });

/* B is active and has sent nothing. A's landed message must not make B read
   as "running" — that is the panel telling you a campaign has gone out when
   it has not. */
ok("a fresh campaign reads 'not started' beside an older one that has run",
   stateFor("acme", [{ ...campA, active: false }, campB], [aRound1]).state === "not started",
   JSON.stringify(stateFor("acme", [{ ...campA, active: false }, campB], [aRound1])));

ok("and 'running' once its own message has landed",
   stateFor("acme", [campB], [send({ campaign_id: "camp-b" })]).state === "running");

ok("and 'queued' while its own message is still pullable",
   stateFor("acme", [campB], [send({ campaign_id: "camp-b", status: "scheduled" })]).state === "queued");

ok("a campaign nobody switched on reads 'paused'",
   stateFor("acme", [{ ...campB, active: false }], []).state === "paused");

ok("an account in no campaign reads 'none'",
   stateFor("other", [campB], []).state === "none");

/* The account-keyed version of this returned "running" for a campaign that
   had never sent anything, because somebody else's message existed. */
ok("another campaign's send cannot make this one look like it has run",
   stateFor("acme", [campB], [send({ campaign_id: "camp-a" })]).state === "not started");

// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
