/* Tests the rule that keeps one sequence on one sending domain.

   Pure functions, for the same reason the render tests are: this decides
   which address a stranger sees a follow-up arrive from, and it has to hold
   without Firestore, Resend or a model in the room.
   Run: npx tsx scripts/outreach-domain-test.ts */
import { bestDomain, startedOn, stillUsable, type ScheduleRequest } from "../src/outreach/send.js";
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

// ---- which domain a new sequence starts on ------------------------------

/* The pool is five domains the way the live config is, with the two small
   ones the live config has. `full` says which (domain, day) pairs have no
   room, so the day a message lands on is the thing under test. */
const pool = OutreachConfig.parse({
  sender_name: "Barak",
  postal_address: "Seaworth, 1 Example Street, London",
  unsubscribe_mailbox: "optout@seaworth.ai",
  timezone: "America/New_York",
  domains: [
    { domain: "seaworth.io", from_local: "b", from_name: "B", daily_cap: 15 },
    { domain: "theseaworth.com", from_local: "b", from_name: "B", daily_cap: 15 },
    { domain: "seaworth.ai", from_local: "b", from_name: "B", daily_cap: 15 },
    { domain: "seaworthhq.com", from_local: "b", from_name: "B", daily_cap: 5 },
    { domain: "tryseaworth.com", from_local: "b", from_name: "B", daily_cap: 5 },
    { domain: "byhand.example", from_local: "b", from_name: "B", manual_only: true },
    { domain: "off.example", from_local: "b", from_name: "B", enabled: false },
  ],
});
const capOfPool: Record<string, number> = {
  "seaworth.io": 15, "theseaworth.com": 15, "seaworth.ai": 15,
  "seaworthhq.com": 5, "tryseaworth.com": 5, "byhand.example": 15, "off.example": 15,
};
const room = (full: Record<string, number> = {}) =>
  (domain: string, day: string) => full[`${domain}__${day}`] ?? capOfPool[domain] ?? 0;

const empty = bestDomain(pool, [], room());
ok("an empty pool has somewhere to go", empty !== null);
ok("the biggest domain goes first when nothing is queued",
   empty?.domain === "seaworth.io", empty?.domain);
ok("a manual-only domain is never the pool's answer",
   bestDomain(pool, [], room())?.domain !== "byhand.example");

/* One message already inside the window on seaworth.io pushes its next slot
   a gap past that one, while every other domain can still take the first
   slot of the window. So the next message belongs to somebody else — that
   is the round robin, and it is the whole of it.

   Inside the window matters: a slot before the window opens is moved to the
   window's first minute, where every domain ties. */
const midWindow = new Date();
midWindow.setUTCDate(midWindow.getUTCDate() + 1);
midWindow.setUTCHours(17, 0, 0, 0); // 13:00 in New York, mid-window
const after1 = bestDomain(pool, [send({
  from_domain: "seaworth.io", status: "scheduled",
  scheduled_at: midWindow.toISOString(),
})], room());
ok("the next message goes to a different domain", after1?.domain !== "seaworth.io",
   after1?.domain);

/* Fifteen messages placed one after another, each one told about the ones
   before it: the count per domain is what stops tomorrow being overspent on
   one identity. */
const placed: SendRecord[] = [];
const left: Record<string, number> = { ...capOfPool };
for (let i = 0; i < 15; i++) {
  const pick = bestDomain(pool, placed, (d) => left[d] ?? 0);
  if (!pick) break;
  left[pick.domain] = (left[pick.domain] ?? 0) - 1;
  placed.push(send({ from_domain: pick.domain, status: "scheduled",
                     scheduled_at: pick.at.toISOString() }));
}
const spreadOver = new Set(placed.map((s) => s.from_domain));
ok("fifteen messages are spread over the pool, not stacked on one",
   placed.length === 15 && spreadOver.size >= 4, `${spreadOver.size} domains`);
ok("and no domain took more than its own cap",
   [...spreadOver].every((d) => placed.filter((s) => s.from_domain === d).length <= capOfPool[d]!));

/* The bug this whole change is about. Every domain is empty today; the one
   the old code always picked is full on the day the message would land. */
const landing = (d: number) => {
  const at = new Date(Date.now() + d * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(at);
};
const tomorrowFull = bestDomain(pool, [], room({
  [`seaworth.io__${landing(0)}`]: 0,
  [`seaworth.io__${landing(24)}`]: 0,
}));
ok("a domain full on the day it would land is passed over",
   tomorrowFull?.domain !== "seaworth.io", tomorrowFull?.domain);
ok("and the pool still has four others", tomorrowFull !== null);

const allFull: Record<string, number> = {};
for (const d of ["seaworth.io", "theseaworth.com", "seaworth.ai", "seaworthhq.com", "tryseaworth.com"]) {
  allFull[`${d}__${landing(0)}`] = 0;
  allFull[`${d}__${landing(24)}`] = 0;
}
ok("with every domain full there is no answer", bestDomain(pool, [], room(allFull)) === null);
ok("a disabled domain is not an answer either",
   bestDomain(pool, [], room(allFull))?.domain !== "off.example");

// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
