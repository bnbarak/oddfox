/* Tests the rails that decide what may be said and to whom. These are pure
   functions on purpose: they are the parts that must hold when the model
   misbehaves, so they must be checkable without a model, a key, or a
   network. Run: npx tsx scripts/outreach-render-test.ts */
import {
  compose, fill, footer, htmlBody, listHeaders, readsAsAutomated, readsAsOptOut,
  varsFor, withFooter,
} from "../src/outreach/render.js";
import { addressIn, canLink, linkFor, tokenFor } from "../src/outreach/unsubToken.js";
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

// ---- the unsubscribe link ---------------------------------------------

/* The whole point of the token is that the endpoint it opens is public. It
   therefore has to be impossible to opt somebody else out by editing a link,
   and impossible to lose an already-sent link by redeploying. */
if (!canLink()) {
  ok("UNSUBSCRIBE_SECRET is set for this run", false,
     "re-run as UNSUBSCRIBE_SECRET=anything npx tsx scripts/outreach-render-test.ts");
} else {
  const t = tokenFor("Vikrant.Malhotra@AngloEastern.com")!;
  ok("a token round-trips to the address, lowercased",
     addressIn(t) === "vikrant.malhotra@angloeastern.com", String(addressIn(t)));
  ok("the same address always gets the same link — one sent last month still works",
     tokenFor("a@b.com") === tokenFor("a@b.com"));
  ok("two addresses get different tokens", tokenFor("a@b.com") !== tokenFor("c@d.com"));

  // The attack: swap the address, keep the signature.
  const forged = `${Buffer.from("someone.else@example.com").toString("base64url")}.${t.split(".")[1]}`;
  ok("a token with the address swapped is refused", addressIn(forged) === null);
  ok("a token with the signature stripped is refused", addressIn(t.split(".")[0]!) === null);
  ok("nonsense is refused, not thrown on", addressIn("!!!") === null);

  const link = linkFor("ana@vgroup.com")!;
  ok("the link is on the unsubscribe host", link.startsWith("https://unsubscribe.seaworth.ai/u/"), link);

  const withLink = withFooter("Thursday?", cfg, null, true, "ana@vgroup.com");
  ok("a commercial message carries the clickable opt-out", withLink.includes(link), withLink);
  ok("and not the reply-only wording", !withLink.includes('Reply "unsubscribe"'), withLink);

  // The distinction the whole footer turns on: a note somebody typed by hand
  // is not a mailing list and must not look like one.
  const personal = withFooter("Good to meet you.", cfg, null, false, "ana@vgroup.com");
  ok("a personal note carries no opt-out at all", !/unsubscribe/i.test(personal), personal);
  ok("and no postal address", !personal.includes("Example Street"));

  const hl = listHeaders(cfg, true, "ana@vgroup.com");
  ok("List-Unsubscribe leads with the URL", hl["List-Unsubscribe"]?.startsWith(`<${link}>`) === true,
     JSON.stringify(hl));
  ok("and keeps the mailto as the fallback", hl["List-Unsubscribe"]?.includes("mailto:") === true);
  ok("one-click is declared, because the endpoint really does accept POST",
     hl["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
  ok("a personal note carries no list headers",
     Object.keys(listHeaders(cfg, false, "ana@vgroup.com")).length === 0);
}

// ---- the HTML half ----------------------------------------------------

const html = htmlBody("Vikrant,\n\nTwenty minutes?", cfg, null, true, "v@ae.com");
ok("HTML keeps paragraphs as paragraphs", (html.match(/<p /g) ?? []).length >= 3, html);
ok("HTML carries the postal address", html.includes("1 Example Street"));
ok("HTML makes the opt-out a real link", /<a href="https:\/\/unsubscribe\./.test(html), html);

// A body is model- or human-written text, and the moment it is put in HTML
// anything angle-bracketed in it becomes markup. It must not.
const nasty = htmlBody('5 < 6 & "quoted" <script>alert(1)</script>', cfg, null, false);
ok("HTML escapes the body rather than emitting it as markup",
   !nasty.includes("<script>") && nasty.includes("&lt;script&gt;"), nasty);
ok("and escapes ampersands and quotes", nasty.includes("&amp;") && nasty.includes("&quot;"));

const both = compose("Thursday?", cfg, null, true, "ana@vgroup.com");
ok("compose returns the two parts saying the same thing",
   both.text.includes("Thursday?") && both.html.includes("Thursday?"));
ok("and both carry the postal address, so the parts do not disagree",
   both.text.includes("1 Example Street") && both.html.includes("1 Example Street"));

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

/* ---- threading a reply from another address -----------------------------

   The address we wrote to is not the address that answers. Somebody mailed
   at a company domain replies from their real one, or from an alias, or a
   colleague answers for them — and keying on the address alone filed the
   answer as a second conversation sitting next to the one it belongs to,
   which is what this caught. Both routes back are checked: the reference
   chain, which is what mail itself threads on, and the subject fallback for
   mail whose headers we never had. */
{
  const { group } = await import("../src/outreach/threads.js");
  const send = (over: Record<string, unknown>) => ({
    id: "s1", account_id: null, contact_id: null, campaign_id: null, company: null,
    to: "Ami@wnwd.com", from_domain: "seaworth.ai", from_address: "barak@seaworth.ai",
    reply_to: null, round: 0, subject: "Ami / Barak", body: "Hi Ami", html: null,
    template_tier: null, written_by: "agent", resend_id: "re_1", message_id: null,
    status: "delivered", last_event: "delivered", opened_at: null, clicked_at: null,
    scheduled_at: "2026-09-13T14:30:00.000Z", quota_day: null,
    created_at: "2026-09-13T14:30:00.000Z", updated_at: "2026-09-13T14:30:00.000Z",
    dry_run: false, error: null, ...over,
  }) as unknown as Parameters<typeof group>[0][number];
  const reply = (over: Record<string, unknown>) => ({
    id: "r1", from: "ami@windward.ai", subject: "Re: Ami / Barak",
    received_at: "2026-09-13T15:09:00.000Z", message_id: "<reply@windward.ai>",
    send_id: null, account_id: null, contact_id: null, excerpt: "Rotem pls set up",
    text: "Rotem pls set up", unsubscribe: false, automated: false, ...over,
  }) as unknown as Parameters<typeof group>[1][number];

  const chained = group(
    [send({ message_id: "<ours@seaworth.ai>" })],
    [reply({ in_reply_to: "<ours@seaworth.ai>", references: ["<ours@seaworth.ai>"] })],
    []);
  ok("a reply quoting our Message-ID lands in the thread",
     chained.length === 1 && chained[0]!.messages.length === 2,
     `${chained.length} threads`);
  ok("and the thread keeps the key it already had",
     chained[0]!.key === "ami@wnwd.com|ami / barak", chained[0]!.key);
  ok("and shows the address we write to, not the one that answered",
     chained[0]!.email === "Ami@wnwd.com", String(chained[0]!.email));
  ok("and counts as replied to", chained[0]!.replies === 1 && chained[0]!.replied);

  const bySubject = group([send({})], [reply({ references: [] })], []);
  ok("a reply quoting nothing still threads on a subject only we used",
     bySubject.length === 1 && bySubject[0]!.messages.length === 2,
     `${bySubject.length} threads`);

  const many = group(
    [send({ id: "s1", to: "a@one.test" }), send({ id: "s2", to: "b@two.test" })],
    [reply({ references: [] })], []);
  ok("but a subject several people were sent is not evidence of anything",
     many.length === 3, `${many.length} threads`);

  const unrelated = group([send({})],
    [reply({ subject: "Re: Something else", references: [] })], []);
  ok("and a different subject stays its own conversation", unrelated.length === 2,
     `${unrelated.length} threads`);

  const fresh = group([send({})], [reply({ subject: "Ami / Barak", references: [] })], []);
  ok("a first message that is not a reply is not merged on its subject",
     fresh.length === 2, `${fresh.length} threads`);
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
