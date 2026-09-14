import { Resend } from "resend";
import { FirestoreCrmRepository } from "../firestoreRepository.js";
import * as crm from "./crm.js";
import { secret } from "./config.js";
import { getConfig } from "./store.js";
import { optOut } from "./optout.js";
import { cleanHtml, htmlToText, readsAsAutomated, readsAsOptOut } from "./render.js";
import {
  allSends, getReply, openSends, patchReply, patchSend, putReply, setCursor,
} from "./store.js";
import { learn } from "./sends.js";

/* Polling, in both directions.

   Resend can push webhooks, but a webhook needs a public unauthenticated
   endpoint and every route here is behind a Google sign-in check. A poll adds
   no attack surface, and at a dozen messages a day the delay costs nothing.

   Both polls are safe to run twice: reply ids are document ids, and a send's
   status only ever moves forward. */

const repo = new FirestoreCrmRepository();
let client: Resend | null = null;
const resend = (): Resend => (client ??= new Resend(secret("RESEND_API_KEY") ?? undefined));

export async function pollEvents(): Promise<number> {
  let changed = 0;
  for (const row of openSends(await allSends())) {
    const { data, error } = await resend().emails.get(row.resend_id!);
    if (error || !data) continue;

    // What the event means is sends.ts's to decide — see learn(), which is
    // the same rule everything else reads these rows with.
    const patch = learn(row, data.last_event ?? "", new Date().toISOString());

    /* The Message-ID, which we cannot know at send time: Resend generates it
       and the send response does not carry it, so this poll is the only
       place it can be learnt. Without it a reply cannot be tied to the
       message it answers and our own follow-ups quote nothing, which is why
       both used to arrive as fresh conversations. */
    if (!row.message_id && data.message_id) patch.message_id = data.message_id;
    if (!Object.keys(patch).length) continue;

    await patchSend(row.id, patch);
    changed++;

    // Resend adds the address to its own suppression list on a bounce or a
    // complaint and will not send to it again; all we owe the CRM is the
    // reason the address stopped working.
    if ((patch.status === "bounced" || patch.status === "complained") && row.contact_id) {
      await repo.patchContact(row.contact_id, { email_status: "bounced" }).catch(() => undefined);
    }
  }
  return changed;
}

/** In-Reply-To and References as this message actually sent them.

    Header names arrive in whatever case the sending client used, and both
    headers hold angle-bracketed ids — References the whole chain, oldest
    first. Everything outside the brackets is folding whitespace and is
    dropped, so the ids compare equal to the ones Resend reports for our own
    mail. Returns nothing rather than empty fields when the headers were not
    fetched, so a failed fetch is not saved as "this answers nothing". */
export function threadChain(headers: Record<string, string> | null | undefined):
  { in_reply_to: string | null; references: string[] } | null {
  if (!headers) return null;
  const header = (name: string): string | null => {
    for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === name) return v;
    return null;
  };
  const ids = (v: string | null): string[] => v?.match(/<[^>\s]+>/g) ?? [];
  const inReplyTo = ids(header("in-reply-to"))[0] ?? null;
  const refs = ids(header("references"));
  return {
    in_reply_to: inReplyTo,
    references: [...new Set([...refs, ...(inReplyTo ? [inReplyTo] : [])])],
  };
}

/** Ties an inbound message to the send it answers, and through it to the
    person and the account.

    The reference chain first: it names the exact message being answered, and
    it is the only signal that survives a reply coming from somewhere other
    than the address we wrote to — an alias, a second company domain, a
    colleague answering on somebody's behalf. Matching the sender's address
    against the CRM is the fallback, for mail that quotes nothing. Getting
    this wrong is not cosmetic: an unattributed human reply leaves the
    contact unmarked, and the rest of their sequence keeps landing. */
async function attribute(from: string, chain: string[]) {
  const addr = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  const contacts = await crm.contacts();
  const contact = contacts.find((c) => c.email?.toLowerCase() === addr);
  const sends = await allSends();
  if (contact) {
    const last = sends.find((s) => s.contact_id === contact.id);
    return { addr, send_id: last?.id ?? null, contact_id: contact.id,
             account_id: contact.account_id };
  }
  const quoted = new Set(chain);
  const answered = sends.find((s) => s.message_id && quoted.has(s.message_id));
  if (!answered) return { addr, send_id: null, contact_id: null, account_id: null };
  const c = answered.contact_id ? contacts.find((x) => x.id === answered.contact_id) : undefined;
  return { addr, send_id: answered.id, contact_id: answered.contact_id ?? null,
           account_id: c?.account_id ?? answered.account_id ?? null };
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
    // Already saved, with its full text and its reference chain: nothing to
    // do. A reply stored before the chain was kept comes back through here
    // once to collect it, which is what threads mail we already hold.
    if (existing && existing.text != null && existing.references != null) continue;

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
      if (full?.data) {
        await patchReply(ref.id, {
          text: text ?? "",
          ...(threadChain(full.data.headers) ?? { in_reply_to: null, references: [] }),
        });
      }
      continue;
    }

    const automated = readsAsAutomated(ref.from, ref.subject ?? null);
    const isOptOut = readsAsOptOut(text) || readsAsOptOut(ref.subject ?? null);
    const chain = threadChain(full?.data?.headers) ?? { in_reply_to: null, references: [] };
    const { addr, send_id, contact_id, account_id } =
      await attribute(ref.from, chain.references);

    await putReply({
      id: ref.id, from: ref.from, subject: ref.subject ?? null, received_at: at,
      message_id: ref.message_id ?? full?.data?.message_id ?? null,
      ...chain,
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
