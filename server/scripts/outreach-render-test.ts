/* Tests the rails that decide what may be said and to whom. These are pure
   functions on purpose: they are the parts that must hold when the model
   misbehaves, so they must be checkable without a model, a key, or a
   network. Run: npx tsx scripts/outreach-render-test.ts */
import {
  fill, footer, listHeaders, readsAsAutomated, readsAsOptOut, varsFor, withFooter,
} from "../src/outreach/render.js";
import { configPatch, OutreachConfig } from "../src/outreach/schemas.js";
import { matchBody, REFUSED } from "../src/outreach/apollo.js";
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
ok("body and footer are separated by one blank line", body.includes("Thursday or Friday?\n\nBarak"), JSON.stringify(body));
ok("no RFC 3676 signature marker", !/^--$/m.test(body), JSON.stringify(body));

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

/* ---- config merge -------------------------------------------------------

   A partial patch must never blank a field it did not mention. Regression
   test for the same incident twice: saving a signature from the settings
   page erased every sending domain, the postal address and the opt-out
   mailbox, and turned dry_run back on.

   The first fix dropped keys whose value was undefined, and the first
   version of this test built its patch by hand with `domains: undefined` —
   so it passed while the live path kept failing. `.partial()` does not strip
   `.default()`: it makes the key optional and then supplies the default for
   the absent one, so the patch arrives carrying `domains: []`, not
   `domains: undefined`. The test now starts from the raw JSON body, which is
   the only thing that knows what was actually asked for. */

const current = OutreachConfig.parse({
  domains: [{ domain: "seaworth.io", from_local: "barak", from_name: "B" }],
  postal_address: "1 Example Street",
  unsubscribe_mailbox: "optout@seaworth.io",
  dry_run: false,
});

// Exactly what the settings page PUTs.
const patchBody = {
  signatures: [{ id: "s", name: "S", body: "B" }],
  default_signature: "s",
  tracked_addresses: ["barak@seaworth.ai"],
};

const filled = OutreachConfig.partial().parse(patchBody) as Record<string, unknown>;
ok("a partial parse fills in defaults rather than leaving keys out",
   Array.isArray(filled.domains) && (filled.domains as unknown[]).length === 0 && filled.dry_run === true);

const merged = OutreachConfig.parse({ ...current, ...configPatch(patchBody) });

ok("a patch that omits domains keeps them", merged.domains.length === 1,
   `${merged.domains.length} domains`);
ok("and keeps the postal address", merged.postal_address === "1 Example Street");
ok("and keeps the opt-out mailbox", merged.unsubscribe_mailbox === "optout@seaworth.io");
ok("and does not turn dry_run back on", merged.dry_run === false);
ok("while applying what it did send", merged.signatures.length === 1);

const naive = OutreachConfig.parse({ ...current, ...OutreachConfig.partial().parse(patchBody) });
ok("the naive spread is what broke it",
   naive.domains.length === 0 && naive.postal_address === null && naive.dry_run === true);


/* ---- threading ---------------------------------------------------------

   Two unrelated notes from the same address are two conversations. Keying
   threads by person alone stacked them, which made the second look like a
   reply to the first. */
{
  const { normaliseSubject } = await import("../src/outreach/threads.js");
  ok("Re: is stripped", normaliseSubject("Re: Marine Security") === "marine security");
  ok("stacked prefixes are stripped",
     normaliseSubject("Re: Fwd: Re: Marine Security") === "marine security");
  ok("different subjects stay different",
     normaliseSubject("Another test!") !== normaliseSubject("Marine Security"));
  ok("empty stays empty", normaliseSubject(null) === "");
}

// eslint-disable-next-line no-console

/* ---- enrichment cost ----------------------------------------------------

   Apollo charges 1 credit for an email and 8 more if a mobile comes back,
   and the waterfall options bill through third-party vendors even when they
   find nothing. The request must therefore carry identifying fields and
   nothing else. This is a cost assertion, not a behaviour one: the failure it
   catches shows up on an invoice, not in the product. */

const asked = matchBody({
  full_name: "Vikrant Malhotra",
  linkedin_url: "https://www.linkedin.com/in/example",
  company: "Anglo-Eastern",
});

ok("enrichment asks by name, profile and employer",
   asked.name === "Vikrant Malhotra" && asked.linkedin_url !== undefined
   && asked.organization_name === "Anglo-Eastern");

for (const p of REFUSED) {
  ok(`enrichment never sends ${p}`, !(p in asked));
}
ok("enrichment never asks for personal emails", !("reveal_personal_emails" in asked));
ok("enrichment sends nothing but identifying fields",
   Object.keys(asked).every((k) =>
     ["name", "first_name", "last_name", "email", "linkedin_url", "organization_name", "domain"]
       .includes(k)),
   Object.keys(asked).join(","));

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exitCode = failed ? 1 : 0;
