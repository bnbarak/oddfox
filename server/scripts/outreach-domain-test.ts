/* Tests the rule that keeps one sequence on one sending domain.

   Pure functions, for the same reason the render tests are: this decides
   which address a stranger sees a follow-up arrive from, and it has to hold
   without Firestore, Resend or a model in the room.
   Run: npx tsx scripts/outreach-domain-test.ts */
import { startedOn, stillUsable, type ScheduleRequest } from "../src/outreach/send.js";
import { OutreachConfig } from "../src/outreach/schemas.js";
import type { SendRecord } from "../src/outreach/schemas.js";

let failed = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  // eslint-disable-next-line no-console
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failed++;
};

const cfg = OutreachConfig.parse({
  sender_name: "Barak",
  postal_address: "Seaworth, 1 Example Street, London",
  unsubscribe_mailbox: "optout@seaworth.ai",
  domains: [
    { domain: "seaworth.io", from_local: "barak", from_name: "Barak Ben Noon" },
    { domain: "theseaworth.com", from_local: "barak", from_name: "Barak Ben Noon" },
    { domain: "off.example", from_local: "barak", from_name: "Barak", enabled: false },
    { domain: "seaworth.ai", from_local: "barak", from_name: "Barak", manual_only: true },
  ],
});

const send = (p: Partial<SendRecord>): SendRecord => ({
  id: Math.random().toString(36).slice(2),
  account_id: "vgroup", contact_id: "ana", campaign_id: "c1", company: "V.Group",
  to: "ana@vgroup.example", from_domain: "seaworth.io",
  from_address: "Barak <barak@seaworth.io>", reply_to: null,
  round: 1, subject: "s", body: "b", html: "<p>b</p>", template_tier: null,
  written_by: "agent", resend_id: null, message_id: null, status: "sent",
  last_event: null, scheduled_at: "2026-09-01T09:00:00.000Z", quota_day: "2026-09-01",
  created_at: "2026-09-01T08:00:00.000Z", updated_at: "2026-09-01T08:00:00.000Z",
  dry_run: false, error: null, ...p,
} as SendRecord);

const req = (p: Partial<ScheduleRequest> = {}): ScheduleRequest => ({
  contact_id: "ana", to: null, round: 2, campaign_id: "c1",
  subject: "s", body: "b", scheduled_at: null, domain: null,
  written_by: "agent", template_tier: null, signature: null,
  in_reply_to: null, references: [],
  ...p,
} as unknown as ScheduleRequest);

// ---- which domain a sequence belongs to ---------------------------------

ok("a first round has nothing to inherit, so the pool decides",
   startedOn(req({ round: 1 } as Partial<ScheduleRequest>), []) === null);

ok("a follow-up returns to the domain round 1 went out on",
   startedOn(req(), [send({ from_domain: "theseaworth.com" })]) === "theseaworth.com");

/* The whole point: without this, round 2 goes to whichever domain has the
   most headroom that morning, and lands in the thread from a stranger. */
ok("the earliest round anchors it, not the most recent",
   startedOn(req({ round: 3 } as Partial<ScheduleRequest>), [
     send({ round: 2, from_domain: "seaworth.io", scheduled_at: "2026-09-05T09:00:00.000Z" }),
     send({ round: 1, from_domain: "theseaworth.com", scheduled_at: "2026-09-01T09:00:00.000Z" }),
   ]) === "theseaworth.com");

ok("another campaign is another conversation and binds nothing",
   startedOn(req(), [send({ campaign_id: "c2", from_domain: "theseaworth.com" })]) === null);

ok("another person's history binds nothing",
   startedOn(req(), [send({ contact_id: "bob", from_domain: "theseaworth.com" })]) === null);

ok("a cancelled round was never seen, so it establishes nothing",
   startedOn(req(), [send({ status: "canceled", from_domain: "theseaworth.com" })]) === null);

ok("a failed round establishes nothing either",
   startedOn(req(), [send({ status: "failed", from_domain: "theseaworth.com" })]) === null);

ok("a hand-typed note is not a sequence round",
   startedOn(req({ round: 0 } as Partial<ScheduleRequest>), [send({})]) === null);

ok("a message to a plain address, outside the CRM, has no sequence",
   startedOn(req({ contact_id: null } as Partial<ScheduleRequest>), [send({})]) === null);

// ---- when a sequence is allowed to move ---------------------------------

ok("an ordinary domain keeps its sequences", stillUsable(cfg, "seaworth.io"));
ok("a disabled domain releases them", !stillUsable(cfg, "off.example"));
ok("a manual-only domain never carries a sequence", !stillUsable(cfg, "seaworth.ai"));
ok("a domain dropped from the config releases them", !stillUsable(cfg, "gone.example"));

// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
