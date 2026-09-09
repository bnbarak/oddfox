import { Resend } from "resend";
import { FirestoreCrmRepository } from "../firestoreRepository.js";
import * as crm from "./crm.js";
import { secret } from "./config.js";
import { getConfig } from "./store.js";
import { readsAsAutomated, readsAsOptOut } from "./render.js";
import {
  allSends, haveReply, openSends, putReply, setCursor, setStatus,
} from "./store.js";
import type { SendStatus } from "./schemas.js";

/* Polling, in both directions.

   Resend can push webhooks, but a webhook needs a public unauthenticated
   endpoint and every route here is behind a Google sign-in check. A poll adds
   no attack surface, and at a dozen messages a day the delay costs nothing.

   Both polls are safe to run twice: reply ids are document ids, and a send's
   status only ever moves forward. */

const repo = new FirestoreCrmRepository();
let client: Resend | null = null;
const resend = (): Resend => (client ??= new Resend(secret("RESEND_API_KEY") ?? undefined));

/** Ranked so a later poll cannot move a message backwards — an 'opened' that
    arrives after a 'clicked' must not undo the click. */
const RANK: Record<string, number> = {
  draft: 0, scheduled: 1, sent: 2, delivered: 3, opened: 4, clicked: 5,
  bounced: 6, complained: 6, failed: 6, canceled: 6,
};

const EVENTS: Record<string, SendStatus> = {
  sent: "sent", delivered: "delivered", opened: "opened", clicked: "clicked",
  bounced: "bounced", complained: "complained", failed: "failed",
  canceled: "canceled", scheduled: "scheduled", delivery_delayed: "delivered",
};

export async function pollEvents(): Promise<number> {
  let changed = 0;
  for (const row of openSends(await allSends())) {
    const { data, error } = await resend().emails.get(row.resend_id!);
    if (error || !data) continue;
    const next = EVENTS[data.last_event ?? ""];
    if (!next || (RANK[next] ?? 0) < (RANK[row.status] ?? 0)) continue;
    if (next === row.status && data.last_event === row.last_event) continue;

    await setStatus(row.id, next, { last_event: data.last_event ?? null });
    changed++;

    // Resend adds the address to its own suppression list on a bounce or a
    // complaint and will not send to it again; all we owe the CRM is the
    // reason the address stopped working.
    if ((next === "bounced" || next === "complained") && row.contact_id) {
      await repo.patchContact(row.contact_id, { email_status: "bounced" }).catch(() => undefined);
    }
  }
  return changed;
}

/** Ties an inbound message to the send it answers. Matching on the sender's
    address is enough here — one contact, one address, at most three messages
    — and it is the only signal every mail client preserves. */
async function attribute(from: string) {
  const addr = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  const contact = (await crm.contacts()).find((c) => c.email?.toLowerCase() === addr);
  if (!contact) return { addr, send_id: null, contact_id: null, account_id: null };
  const last = (await allSends()).find((s) => s.contact_id === contact.id);
  return { addr, send_id: last?.id ?? null, contact_id: contact.id, account_id: contact.account_id };
}

export async function pollReplies(): Promise<number> {
  const cfg = await getConfig();
  // Resend receives mail for every address at every domain we have MX for.
  // Only what we deliberately watch is ingested: a listened domain, or an
  // individually tracked mailbox on one we do not listen to.
  const listening = new Set(
    cfg.domains.filter((d) => d.listen_inbound).map((d) => d.domain.toLowerCase()));
  const tracked = new Set(cfg.tracked_addresses.map((a) => a.trim().toLowerCase()));
  const heard = (to: string[]) =>
    to.some((raw) => {
      const a = (raw.match(/<([^>]+)>/)?.[1] ?? raw).trim().toLowerCase();
      return tracked.has(a) || listening.has((a.split("@")[1] ?? "").trim());
    });

  const { data, error } = await resend().emails.receiving.list({ limit: 100 });
  if (error || !data) return 0;

  let stored = 0;

  /* Deliberately no timestamp cursor.

     There used to be one, and it was wrong: it advanced past mail that had
     been skipped, so adding an address to the watch list could never pick up
     anything already received — the messages were permanently invisible.
     Deduplication is by document id instead, which is what actually makes
     this idempotent, and it means a newly watched mailbox backfills from
     whatever Resend still holds. At a dozen messages a day, re-reading one
     page a minute costs nothing. */
  for (const ref of data.data) {
    if (!heard(ref.to)) continue;
    if (await haveReply(ref.id)) continue;

    const at = new Date(ref.created_at).toISOString();
    const full = await resend().emails.receiving.get(ref.id).catch(() => null);
    const text = full?.data?.text ?? null;
    const automated = readsAsAutomated(ref.from, ref.subject ?? null);
    const optOut = readsAsOptOut(text) || readsAsOptOut(ref.subject ?? null);
    const { addr, send_id, contact_id, account_id } = await attribute(ref.from);

    await putReply({
      id: ref.id, from: ref.from, subject: ref.subject ?? null, received_at: at,
      message_id: ref.message_id ?? full?.data?.message_id ?? null,
      send_id, account_id, contact_id,
      excerpt: text ? text.replace(/\s+/g, " ").slice(0, 800) : null,
      unsubscribe: optOut, automated,
    });
    stored++;

    // The one thing Resend cannot infer: somebody typed "unsubscribe" in a
    // reply. Its suppression list is the right home for it, so it applies
    // everywhere and there is no second list to disagree with the first.
    if (optOut) {
      await resend().suppressions.add({ email: addr }).catch(() => undefined);
    }

    // A real human reply ends the sequence. An out-of-office does not — that
    // is the whole reason the automated check exists.
    if (!automated && !optOut && contact_id) {
      await repo.patchContact(contact_id, { replied: true, status: "replied" }).catch(() => undefined);
      if (account_id) {
        await repo.patchAccount(account_id, { status: "replied", last_touch: at.slice(0, 10) })
          .catch(() => undefined);
      }
    }
  }

  await setCursor(new Date().toISOString());   // kept for "when did we last look"
  return stored;
}
