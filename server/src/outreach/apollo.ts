import { db } from "../firebaseApp.js";
import { secret } from "./config.js";
import type { ContactRecord } from "../schemas.js";

/* Apollo people enrichment: finding a work email for somebody we are about to
   write to.

   This file exists because the API costs real money and the obvious way to
   use it is the expensive way. Two rules from the owner of the budget, both
   enforced here rather than left to whoever calls this next:

     1. Enrich only when we are ready to send, inside a campaign. Not on a
        sweep of the CRM, not when a page loads, not to "fill in the gaps".
        The trigger is a written, confirmed message that has nowhere to go.
     2. Emails only. Never phone numbers.

   Rule 2 is the one with a price tag on it. Apollo charges 1 credit for
   demographics or an email and *8 more* if a mobile number comes back, so a
   stray `reveal_phone_number` makes every lookup nine times its cost. The
   waterfall options are worse: they fan out to third-party vendors who bill
   per lookup whether or not they find anything, so a miss is no longer free.
   None of those parameters are set anywhere below, and REFUSED lists them so
   that adding one is a deliberate act rather than a plausible-looking edit.

   `reveal_personal_emails` is also off. It costs extra, Apollo will not
   return personal addresses for anyone in a GDPR region anyway, and a
   personal address is the wrong thing to cold-mail a fleet director at. */

const MATCH = "https://api.apollo.io/api/v1/people/match";
const LEDGER = "crmEnrichment";
const SPEND = "crmEnrichSpend";

/** Parameters that turn a 1-credit lookup into a 9-credit one, or that bill
    through third-party vendors even on a miss. Never sent. */
const REFUSED = [
  "reveal_phone_number", "run_waterfall_phone", "run_waterfall_email", "webhook_url",
] as const;

/** A day's ceiling on credits, as a backstop rather than a budget. Nothing
    here should ever approach it: the caller only fires on a confirmed send,
    and each contact is looked up at most once ever. If this trips, something
    is calling enrichment in a loop and the right response is to find it, not
    to raise the number. */
const DAILY_CREDIT_CAP = 25;

/** The request we send Apollo: identifying fields only.

    Every field here improves the match at no extra cost. Nothing here turns
    on a paid extra — that is asserted in outreach-render-test.ts against
    REFUSED, so a future edit that adds `reveal_phone_number` to "get more
    data" fails the build rather than the invoice. */
export function matchBody(contact: Pick<ContactRecord, "full_name" | "linkedin_url" | "company">) {
  const body: Record<string, string> = { name: contact.full_name };
  if (contact.linkedin_url) body.linkedin_url = contact.linkedin_url;
  if (contact.company) body.organization_name = contact.company;
  return body;
}

export type Enrichment = {
  contact_id: string;
  /** Whether Apollo returned a work email. False is a real, final answer and
      is cached exactly like a hit — see below. */
  matched: boolean;
  email: string | null;
  confidence: string | null;
  credits: number;
  at: string;
  request_id: string | null;
  note: string | null;
};

/** What we already know about this person, hit or miss.

    Misses are cached deliberately. A person Apollo has no address for is the
    single most expensive thing in this system if it is not written down: the
    campaign is still active, the message still has nowhere to go, and every
    attempt asks again and pays again for the same "no". One lookup per
    contact, ever, is the whole cost model. */
export const known = async (contactId: string): Promise<Enrichment | null> => {
  const snap = await db().collection(LEDGER).doc(contactId).get();
  return snap.exists ? (snap.data() as Enrichment) : null;
};

/** Credits spent today, and the ledger that records them. Kept per day so the
    cap above means something and so the spend is visible without adding up
    the whole collection. */
export async function spentToday(day = new Date().toISOString().slice(0, 10)): Promise<number> {
  const snap = await db().collection(SPEND).doc(day).get();
  return snap.exists ? ((snap.data()?.credits as number) ?? 0) : 0;
}

export const configured = (): boolean => Boolean(secret("APOLLO_API_KEY"));

/** Looks up one person's work email.

    Callers must have already established that this is a confirmed send for a
    contact in an active campaign who has no address — this function does not
    re-derive that, it only refuses to spend twice on the same person. */
export async function findEmail(contact: ContactRecord): Promise<Enrichment> {
  const cached = await known(contact.id);
  if (cached) return cached;

  const record = async (e: Omit<Enrichment, "contact_id" | "at">): Promise<Enrichment> => {
    const full: Enrichment = { ...e, contact_id: contact.id, at: new Date().toISOString() };
    await db().collection(LEDGER).doc(contact.id).set(full);
    if (full.credits > 0) {
      const day = full.at.slice(0, 10);
      await db().collection(SPEND).doc(day).set(
        { day, credits: (await spentToday(day)) + full.credits }, { merge: true });
    }
    return full;
  };

  const key = secret("APOLLO_API_KEY");
  // Not written to the ledger: no key is our problem, not a fact about this
  // person, and caching it would stop the real lookup ever happening.
  if (!key) {
    return { contact_id: contact.id, at: new Date().toISOString(), matched: false, email: null,
             confidence: null, credits: 0, request_id: null, note: "APOLLO_API_KEY is not set" };
  }

  if ((await spentToday()) >= DAILY_CREDIT_CAP) {
    return { contact_id: contact.id, at: new Date().toISOString(), matched: false, email: null,
             confidence: null, credits: 0, request_id: null,
             note: `enrichment stopped: ${DAILY_CREDIT_CAP} credits already spent today` };
  }

  const body = matchBody(contact);
  const res = await fetch(MATCH, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // A failed call is not an answer about this person, so it is not cached.
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    request_id?: number | string;
    person?: { email?: string | null; match_confidence?: string | null } | null;
  };

  const email = data.person?.email?.trim() || null;
  /* Apollo bills 1 credit when it returns an email and nothing when it has
     no credit-consuming data, so a miss is free — but it is still written
     down, because the point of the ledger is to not ask twice. */
  return record({
    matched: Boolean(email),
    email,
    confidence: data.person?.match_confidence ?? null,
    credits: email ? 1 : 0,
    request_id: data.request_id != null ? String(data.request_id) : null,
    note: email ? null : "Apollo has no work email for this person",
  });
}

export { DAILY_CREDIT_CAP, REFUSED };
