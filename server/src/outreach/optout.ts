import { Resend } from "resend";
import { FirestoreCrmRepository } from "../firestoreRepository.js";
import * as crm from "./crm.js";
import { secret } from "./config.js";
import { cancelAllTo } from "./send.js";
import { isOptedOut, recordOptOut, restoreOptOut, type OptOut } from "./store.js";

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
    // Kept so opting them back in can restore what they were, rather than
    // guessing a status or leaving them dead forever.
    prior_status: contact?.status ?? null,
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

/* Undoing an opt-out.

   This exists because people do ask to be put back on — they changed roles,
   they unsubscribed by accident, they said yes on a call. It is deliberately
   a separate function with its own record rather than a flag on optOut():
   suppressing somebody and un-suppressing them are not symmetrical acts, and
   the second one should be hard to do by accident.

   What it does NOT do is erase the fact that they asked. The row stays with
   restored_at set, so the panel and any later argument can still see that an
   opt-out happened and that somebody reversed it on purpose. */
export type RestoreResult = {
  email: string;
  /** False when there was no opt-out to undo. */
  found: boolean;
  /** The pipeline status the contact was put back to, when we had recorded
      one to put back. */
  restored_status: string | null;
  contact_id: string | null;
};

export async function optBackIn(
  email: string, note: string | null = null,
): Promise<RestoreResult> {
  const addr = email.trim().toLowerCase();

  // Resend first. Our own row is what the panel reads, so it must not say
  // "sendable" while the provider is still refusing to send.
  if (secret("RESEND_API_KEY")) {
    await resend().suppressions.remove(addr).catch(() => undefined);
  }

  const row = await restoreOptOut(addr, note);
  if (!row) return { email: addr, found: false, restored_status: null, contact_id: null };

  /* Put the pipeline record back where it was. Only when we recorded it —
     a row written before prior_status existed leaves the contact "dead", and
     inventing a status for them would be worse than leaving it for a person
     to set. */
  let restored: string | null = null;
  if (row.contact_id && row.prior_status) {
    await repo.patchContact(row.contact_id, { status: row.prior_status as never })
      .then(() => { restored = row.prior_status ?? null; })
      .catch(() => undefined);
  }

  return { email: addr, found: true, restored_status: restored, contact_id: row.contact_id };
}
