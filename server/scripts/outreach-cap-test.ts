/* Proves the daily cap holds under concurrency, against a real Firestore.

   This is the one guarantee in the whole subsystem that has to be a database
   guarantee rather than a careful bit of code: two requests that both read 14
   must not both write 15. Exceeding the cap on a young sending domain is what
   gets the domain filed as spam, and that does not come back.

   Run with gcloud's stored user credentials, so no browser is needed:
     GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/legacy_credentials/<account>/adc.json \
       npx tsx scripts/outreach-cap-test.ts [projectId]
*/
import { applicationDefault, initializeApp } from "firebase-admin/app";

const project = process.argv[2] ?? "maine-507401";

// firebase-admin's Firestore client only accepts a certificate or ADC, so
// point GOOGLE_APPLICATION_CREDENTIALS at gcloud's own stored user
// credentials, which carry a refresh token:
//   ~/.config/gcloud/legacy_credentials/<account>/adc.json
initializeApp({ projectId: project, credential: applicationDefault() });

const { headroom, release, reserve } = await import("../src/outreach/store.js");
const { db } = await import("../src/firebaseApp.js");
const { OutreachConfig } = await import("../src/outreach/schemas.js");

let failed = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  // eslint-disable-next-line no-console
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failed++;
};

const DOMAIN = "captest.invalid";
const DAY = "2000-01-01";
const doc = () => db().collection("crmQuota").doc(`${DOMAIN}__${DAY}`);

await doc().delete().catch(() => undefined);

// Sequential: the cap must hold at exactly the cap, and keep holding.
const seq: (number | null)[] = [];
for (let i = 0; i < 18; i++) seq.push(await reserve(DOMAIN, DAY, 15));
ok("15 reservations succeed, numbered 1..15",
   seq.slice(0, 15).every((v, i) => v === i + 1), JSON.stringify(seq.slice(0, 3)));
ok("the 16th is refused", seq[15] === null);
ok("and so is the 17th", seq[16] === null);

// Concurrent: this is the case a plain read-then-write gets wrong.
await doc().delete().catch(() => undefined);
const race = await Promise.all(Array.from({ length: 20 }, () => reserve(DOMAIN, DAY, 5)));
const winners = race.filter((r): r is number => r !== null);
ok("20 concurrent claims against a cap of 5 yield exactly 5",
   winners.length === 5, `got ${winners.length}`);
ok("and the winners are numbered 1..5",
   [...winners].sort((a, b) => a - b).join(",") === "1,2,3,4,5",
   [...winners].sort((a, b) => a - b).join(","));
ok("the stored counter agrees", Number((await doc().get()).data()?.used) === 5);

await release(DOMAIN, DAY);
ok("release gives a slot back", Number((await doc().get()).data()?.used) === 4);

const cfg = OutreachConfig.parse({
  timezone: "UTC",
  domains: [{ domain: DOMAIN, from_local: "x", from_name: "X", daily_cap: 15 }],
});
const rooms = await headroom(cfg);
ok("headroom reports a full cap on an untouched day",
   rooms[0]?.left === 15 && rooms[0]?.used === 0, JSON.stringify(rooms));
ok("a configured domain is listed first, and sends", rooms[0]?.domain === DOMAIN && rooms[0]?.sends === true);

/* Every domain in SENDERS is listed, switched on or not, so the Outreach
   panel shows the same addresses Settings does. The ones not switched on
   must have no room at all — a cap of 0 is what keeps pickDomain off them. */
const { SENDERS } = await import("../src/outreach/config.js");
const idle = rooms.filter((r) => !r.sends);
ok("every SENDERS domain not configured here is listed",
   SENDERS.every((x) => rooms.some((r) => r.domain === x.domain)),
   rooms.map((r) => r.domain).join(","));
ok("and none of them has any room", idle.length > 0 && idle.every((r) => r.cap === 0 && r.left === 0),
   JSON.stringify(idle.map((r) => [r.domain, r.cap, r.left])));

await doc().delete().catch(() => undefined);
// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
