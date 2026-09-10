/* Proves an unsubscribe actually unsubscribes, against a real Firestore.

   The pure half of this — signing links, refusing forged ones, what the
   footer and headers say — is in outreach-render-test.ts and needs nothing.
   What is left is the half that only exists as writes: the record, the
   queued mail being pulled back, and the refusal to write to that address
   afterwards. Those are the parts that would fail silently, and the parts
   that matter if somebody ever says they were emailed after opting out.

   It works on an address at .invalid, which cannot belong to anybody, and
   cleans up after itself. Nothing reaches Resend: RESEND_API_KEY is
   deliberately cleared below, and the send it queues is a dry run.

   Run with gcloud's stored user credentials, so no browser is needed:
     UNSUBSCRIBE_SECRET=anything \
     GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/legacy_credentials/<account>/adc.json \
       npx tsx scripts/outreach-optout-test.ts [projectId]
*/
import { applicationDefault, initializeApp } from "firebase-admin/app";

const project = process.argv[2] ?? "maine-507401";

// Nothing may reach Resend from a test. Cleared before anything imports it,
// because send.ts reads it to decide whether a send is a dry run.
delete process.env.RESEND_API_KEY;

initializeApp({ projectId: project, credential: applicationDefault() });

const { db } = await import("../src/firebaseApp.js");
const { isOptedOut, putSend, getSend } = await import("../src/outreach/store.js");
const { optOut } = await import("../src/outreach/optout.js");
const { schedule, Refused } = await import("../src/outreach/send.js");
const { addressIn, canLink, tokenFor } = await import("../src/outreach/unsubToken.js");
const { OutreachConfig } = await import("../src/outreach/schemas.js");

let failed = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  // eslint-disable-next-line no-console
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failed++;
};

if (!canLink()) {
  // eslint-disable-next-line no-console
  console.log("UNSUBSCRIBE_SECRET is not set — re-run with it, or nothing here is meaningful.");
  process.exit(1);
}

const ADDR = "optout-test@example.invalid";
const SEND_ID = "optout-test-send";
const optDoc = () => db().collection("crmOptOuts").doc(ADDR);
const sendDoc = () => db().collection("crmSends").doc(SEND_ID);

const cleanup = async () => {
  await optDoc().delete().catch(() => undefined);
  await sendDoc().delete().catch(() => undefined);
};
await cleanup();

const cfg = OutreachConfig.parse({
  timezone: "UTC",
  sender_name: "Barak",
  postal_address: "Seaworth, 1 Example Street, London",
  unsubscribe_mailbox: "optout@seaworth.ai",
  dry_run: true,
  domains: [{ domain: "seaworth.io", from_local: "barak", from_name: "Barak Ben Noon" }],
});

// A message already queued for this address — the thing that has to stop.
const now = new Date().toISOString();
await putSend({
  id: SEND_ID, account_id: null, contact_id: null, company: null,
  to: ADDR, from_domain: "seaworth.io", from_address: "Barak <barak@seaworth.io>",
  reply_to: null, round: 1, subject: "test", body: "test", html: null,
  template_tier: null, written_by: "template", resend_id: null, message_id: null,
  status: "scheduled", last_event: null,
  scheduled_at: new Date(Date.now() + 864e5).toISOString(),
  quota_day: null, created_at: now, updated_at: now, dry_run: true, error: null,
});
ok("a message is queued for the address", (await getSend(SEND_ID))?.status === "scheduled");

// The click.
const result = await optOut(addressIn(tokenFor(ADDR)!)!, "link", "test run");
ok("the opt-out is recorded as a first-time request", result.first_time);
ok("and reports what it pulled back", result.canceled === 1, String(result.canceled));

const stored = (await optDoc().get()).data();
ok("the record says who", stored?.email === ADDR, JSON.stringify(stored));
ok("and how they told us", stored?.source === "link");
ok("and when", typeof stored?.at === "string" && String(stored.at).startsWith("20"));

ok("the queued message is cancelled", (await getSend(SEND_ID))?.status === "canceled");
ok("the address reads as opted out", await isOptedOut(ADDR));
ok("and case does not matter", await isOptedOut(ADDR.toUpperCase()));

// The point of all of it: nothing can be sent to them again, by any route.
const refused = await schedule(
  { contact_id: null, to: ADDR, round: 1, subject: "again", body: "hello",
    domain: "seaworth.io", signature: null, template_tier: null, written_by: "template",
    scheduled_at: null, in_reply_to: null, references: [] } as never,
  cfg, []).then(() => null, (e: unknown) => e);
ok("a further send is refused", refused instanceof Refused,
   refused instanceof Error ? refused.message : String(refused));
ok("and refused for the right reason",
   refused instanceof Refused && refused.code === "opted-out",
   refused instanceof Refused ? refused.code : "");

// Asking twice is not an error, and does not rewrite the original event.
const again = await optOut(ADDR, "reply", "second time");
ok("a repeat opt-out is not a new one", !again.first_time);
ok("and the record keeps how they first told us",
   (await optDoc().get()).data()?.source === "link");

await cleanup();
// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
