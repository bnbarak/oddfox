import { Resend } from "resend";
import { FirestoreCrmRepository } from "../firestoreRepository.js";
import * as crm from "./crm.js";
import { secret } from "./config.js";
import { cancelAllTo } from "./send.js";
import { isOptedOut, recordOptOut, type OptOut } from "./store.js";

/* What "unsubscribe" actually has to do.

   Four things, and doing three of them is the same as doing none:

     1. Write it down. crmOptOuts is the evidence — who, when, how.
     2. Suppress the address at Resend, so nothing on any domain, from any
        key, can reach it again.
     3. Pull back what is already queued. A sequence booked a week out would
        otherwise keep landing after they asked it to stop, which is exactly
        the experience they clicked the link to end.
     4. Mark the CRM record, so a person looking at the pipeline sees it too
        and does not go write to them by hand.

   Every step is idempotent and every step tolerates the others failing. A
   Resend outage must not stop us recording the request, and a contact we
   cannot find must not stop us suppressing the address. */

const repo = new FirestoreCrmRepository();

let client: Resend | null = null;
const resend = (): Resend => (client ??= new Resend(secret("RESEND_API_KEY") ?? undefined));

export type OptOutResult = {
  email: string;
  /** False when this address had already opted out. The page says the same
      thing either way — from the reader's side both mean "you are off the
      list" — but the caller logs the difference. */
  first_time: boolean;
  canceled: number;
  contact_id: string | null;
};

/** Records an opt-out and makes it true everywhere. `source` says how they
    told us; see OptOut in store.ts. */
export async function optOut(
  email: string, source: OptOut["source"], note: string | null = null,
): Promise<OptOutResult> {
  const addr = email.trim().toLowerCase();
  const already = await isOptedOut(addr);

  // Cancel first, and suppress second. The other order leaves a window where
  // a queued message is released by Resend between the two calls.
  const { canceled } = await cancelAllTo(addr).catch(() => ({ canceled: 0, failed: 0 }));

  if (secret("RESEND_API_KEY")) {
    await resend().suppressions.add({ email: addr }).catch(() => undefined);
  }

  const contact = (await crm.contacts().catch(() => []))
    .find((c) => c.email?.trim().toLowerCase() === addr) ?? null;

  await recordOptOut({
    email: addr,
    contact_id: contact?.id ?? null,
    account_id: contact?.account_id ?? null,
    source,
    at: new Date().toISOString(),
    note,
    canceled,
  });

  /* The pipeline record. "dead" is the existing end state and the right one:
     this person is not a lead any more, and leaving them at "round 1 sent"
     invites somebody to follow up by hand. The note says why, because "dead"
     on its own reads as "never answered" and this is a different thing.

     email_status stays as it was on purpose — the address is not wrong, and
     overwriting a verified address with a status meaning "do not use" would
     lose the one fact enrichment paid for. What forbids the send is the
     opt-out record, which send.ts checks by address. */
  if (contact) {
    await repo.patchContact(contact.id, {
      status: "dead",
      notes: [contact.notes, `Unsubscribed ${new Date().toISOString().slice(0, 10)}.`]
        .filter(Boolean).join(" ").slice(0, 2000),
    }).catch(() => undefined);
  }

  return { email: addr, first_time: !already, canceled, contact_id: contact?.id ?? null };
}
