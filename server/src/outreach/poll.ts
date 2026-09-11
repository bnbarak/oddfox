import { Resend } from "resend";
import { FirestoreCrmRepository } from "../firestoreRepository.js";
import * as crm from "./crm.js";
import { secret } from "./config.js";
import { getConfig } from "./store.js";
import { optOut } from "./optout.js";
import { cleanHtml, htmlToText, readsAsAutomated, readsAsOptOut } from "./render.js";
import {
  allSends, getReply, openSends, patchReply, putReply, setCursor, setStatus,
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
    const existing = await getReply(ref.id);
    // Already saved, with its full text: nothing to do.
    if (existing && existing.text != null) continue;

    const at = new Date(ref.created_at).toISOString();
    const full = await resend().emails.receiving.get(ref.id).catch(() => null);
    /* The message as written, line breaks and all — what the Inbox shows.
       It used to be squashed onto one line and cut at 800 characters, which
       ran a reply into the quoted history under it and dropped the end of
       any long one. An HTML-only message is turned into text the same way
       formatted mail is. Capped far below Firestore's 1 MB document limit. */
    const raw = full?.data?.text
      ?? (full?.data?.html ? htmlToText(cleanHtml(full.data.html)) : null);
    const text = raw ? raw.slice(0, 50_000) : null;

    /* Saved before the full text was kept. Fill it in and stop: the opt-out
       check and the "they replied" marking below already ran when it first
       arrived, and must not run twice. "" when Resend has no body either, so
       it is not asked for again every minute. A failed fetch leaves it for
       the next poll. Not counted in `stored` — it is not new mail. */
    if (existing) {
      if (full?.data) await patchReply(ref.id, { text: text ?? "" });
      continue;
    }

    const automated = readsAsAutomated(ref.from, ref.subject ?? null);
    const isOptOut = readsAsOptOut(text) || readsAsOptOut(ref.subject ?? null);
    const { addr, send_id, contact_id, account_id } = await attribute(ref.from);

    await putReply({
      id: ref.id, from: ref.from, subject: ref.subject ?? null, received_at: at,
      message_id: ref.message_id ?? full?.data?.message_id ?? null,
      send_id, account_id, contact_id,
      excerpt: text ? text.replace(/\s+/g, " ").slice(0, 800) : null,
      text: text ?? "",
      unsubscribe: isOptOut, automated,
    });
    stored++;

    // The one thing Resend cannot infer: somebody typed "unsubscribe" in a
    // reply. It goes through exactly the same path as a click on the link, so
    // a typed opt-out and a clicked one are the same event with a different
    // `source` — recorded, suppressed at Resend, queued mail pulled back, and
    // the contact marked. Typing it used to only write the suppression, which
    // left the rest of their sequence to keep landing.
    if (isOptOut) {
      await optOut(addr, "reply", `reply ${ref.id}`).catch(() => undefined);
    }

    // A real human reply ends the sequence. An out-of-office does not — that
    // is the whole reason the automated check exists.
    if (!automated && !isOptOut && contact_id) {
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
