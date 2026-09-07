/* Tests the rails that decide what may be said and to whom. These are pure
   functions on purpose: they are the parts that must hold when the model
   misbehaves, so they must be checkable without a model, a key, or a
   network. Run: npx tsx scripts/outreach-render-test.ts */
import {
  fill, footer, listHeaders, readsAsAutomated, readsAsOptOut, varsFor, withFooter,
} from "../src/outreach/render.js";
import { OutreachConfig } from "../src/outreach/schemas.js";
import type { AccountRecord, ContactRecord } from "../src/schemas.js";

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
});

const account = {
  id: "vgroup", company: "V.Group", tier: 1, tier_name: "Third-party ship managers",
  fleet: 900, country: null, vessel_attacked: null, notes: null,
} as unknown as AccountRecord;

const contact = {
  id: "vgroup-1", account_id: "vgroup", company: "V.Group",
  full_name: "Ana Maria Costa", title: "Fleet Director",
} as unknown as ContactRecord;

// ---- variables --------------------------------------------------------

const vars = varsFor(account, contact, cfg);
ok("first name is the first token, not the whole name", vars.first_name === "Ana");
ok("fleet comes through as a string", vars.fleet === "900");
ok("a fact we do not hold is null, not empty", vars.vessel === null);

const good = fill("{{first_name}}, {{company}} manages {{fleet}} hulls. — {{sender}}", vars);
ok("a fillable template resolves completely", good.unresolved.length === 0, good.text);
ok("and reads correctly", good.text === "Ana, V.Group manages 900 hulls. — Barak", good.text);

// The important half: a variable we cannot honestly fill must be REPORTED,
// and must be left visibly broken rather than silently blanked. A blank
// reads as finished prose; "{{vessel}}" cannot be mistaken for finished.
const bad = fill("We saw what happened to {{vessel}} on {{incident_date}}.", vars);
ok("an unfillable variable is reported", bad.unresolved.sort().join(",") === "incident_date,vessel",
   bad.unresolved.join(","));
ok("and is left in the text, not blanked", bad.text.includes("{{vessel}}"), bad.text);

// ---- the footer -------------------------------------------------------

const body = withFooter("Thursday or Friday?", cfg);
ok("footer carries a named sender", body.includes("Barak"));
ok("footer carries the postal address", body.includes("1 Example Street"));
ok("footer tells the reader how to stop", /unsubscribe/i.test(body));
ok("body and footer are separated once", body.includes("Thursday or Friday?\n\n--\n"), JSON.stringify(body));

const bare = OutreachConfig.parse({ sender_name: "Barak" });
ok("with no address configured the footer claims none", !footer(bare).includes("Street"));
ok("and no unsubscribe line is invented", !/unsubscribe/i.test(footer(bare)), footer(bare));

const h = listHeaders(cfg);
ok("List-Unsubscribe points at the opt-out mailbox",
   h["List-Unsubscribe"] === "<mailto:optout@seaworth.ai?subject=unsubscribe>", JSON.stringify(h));
ok("and is omitted when there is no mailbox", Object.keys(listHeaders(bare)).length === 0);

// ---- reading what comes back ------------------------------------------

for (const t of [
  "Please unsubscribe me.",
  "Take me off this list",
  "Do not contact me again",
  "please remove me from your mailing",
  "I would like to OPT-OUT",
  "stop emailing me",
]) ok(`opt-out recognised: "${t}"`, readsAsOptOut(t));

for (const t of [
  "Thanks — can you do Thursday at 10?",
  "Not for us right now, but keep in touch.",
  "Who should I put you in touch with?",
]) ok(`normal reply not mistaken for an opt-out: "${t.slice(0, 34)}…"`, !readsAsOptOut(t));

ok("null body is not an opt-out", !readsAsOptOut(null));

ok("mailer-daemon is automated", readsAsAutomated("MAILER-DAEMON@x.com", "Undeliverable"));
ok("out of office is automated", readsAsAutomated("ana@vgroup.com", "Out of Office: back Monday"));
ok("automatic reply is automated", readsAsAutomated("ana@vgroup.com", "Automatic reply: Annual leave"));
ok("no-reply is automated", readsAsAutomated("no-reply@vgroup.com", "Receipt"));
ok("a real person is not automated", !readsAsAutomated("Ana <ana@vgroup.com>", "Re: escort"));

// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exitCode = failed ? 1 : 0;
