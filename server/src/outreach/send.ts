import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import * as apollo from "./apollo.js";
import * as crm from "./crm.js";
import { capOf, domainOf, fromAddress, secret } from "./config.js";
import { compose, listHeaders } from "./render.js";
import {
  allCampaigns, allSends, getSend, isOptedOut, pickDomain, putSend, release, reserve, setStatus,
} from "./store.js";
import type { OutreachConfig, ScheduleRequest, SendRecord } from "./schemas.js";
import { dayKey, nextInWindow } from "./time.js";

/* Scheduling a message — the only path to Resend.

   Nothing is ever sent immediately, even when the slot is two minutes away.
   Everything goes out with a `scheduled_at`, which means Resend holds it and
   returns an id that will cancel it. That id is the whole reason a mistake
   caught in the next twenty minutes costs nothing.

   Bounces and complaints are still Resend's list to keep: it adds to it by
   itself and skips sending to anything on it, across the whole team, and a
   second copy would only give us something to disagree with. What we do keep
   is the opt-out list — see store.ts — because a person who clicked
   unsubscribe is a fact about our relationship with them, not a delivery
   event, and it has to be checkable before an address is ever used. */

let client: Resend | null = null;
const resend = (): Resend => (client ??= new Resend(secret("RESEND_API_KEY") ?? undefined));

/** In-Reply-To and References, the headers that make a client thread a reply
    into the conversation it answers. References carries the whole chain and
    the message being answered, oldest first; without it long threads split. */
function threadHeaders(inReplyTo: string | null, references: string[]): Record<string, string> {
  if (!inReplyTo) return {};
  const chain = [...new Set([...references, inReplyTo])].filter(Boolean);
  return { "In-Reply-To": inReplyTo, References: chain.join(" ") };
}

/** Whether this contact's account is in a campaign that is switched on.

    Enrichment is gated on this rather than on "is a sequence round", because
    a campaign is the thing a person deliberately started. An automated
    follow-up to somebody outside every campaign must not quietly buy data. */
async function inActiveCampaign(contact: { account_id: string | null }): Promise<boolean> {
  if (!contact.account_id) return false;
  const live = (await allCampaigns()).filter((c) => c.active);
  return live.some((c) => c.account_ids.includes(contact.account_id!));
}

export class Refused extends Error {
  constructor(readonly code: string, message: string, readonly status = 409) {
    super(message);
    this.name = "Refused";
  }
}

/** Minutes between two messages from the same domain: the day's cap spread
    across the sending window. Fifteen across 8am–5pm is one every thirty-six
    minutes, which is what a person sending by hand looks like. A burst at
    nine o'clock is what a bot looks like. */
function gapMinutes(cfg: OutreachConfig, domain: string): number {
  const hours = Math.max(1, cfg.send_window.end_hour - cfg.send_window.start_hour);
  return Math.max(3, Math.floor((hours * 60) / Math.max(1, capOf(cfg, domain))));
}

/** The next free slot for `domain`: inside the window, at least two minutes
    out, and a decent gap after whatever that domain already has queued. */
export function nextSlot(cfg: OutreachConfig, domain: string, queued: SendRecord[]): Date {
  const latest = queued
    .filter((s) => s.from_domain === domain && s.status === "scheduled" && s.scheduled_at)
    .map((s) => new Date(s.scheduled_at!).getTime())
    .filter((t) => t > Date.now())
    .sort((a, b) => b - a)[0];
  const earliest = Date.now() + 2 * 60 * 1000;
  const after = latest ? latest + gapMinutes(cfg, domain) * 60 * 1000 : earliest;
  return nextInWindow(new Date(Math.max(earliest, after)), cfg.timezone,
                      cfg.send_window.start_hour, cfg.send_window.end_hour);
}

/** The domain a sequence began on, if it has one.

    Keyed on the campaign as well as the person, because due() groups the
    same way: two campaigns writing to one person are two conversations, and
    each is entitled to its own thread. Read from the earliest round rather
    than the most recent, so the whole sequence anchors to where it started
    and one stray message cannot drag the rest onto a new domain.

    Cancelled rounds do not count — a message that was pulled back was never
    seen, so it did not establish anything. */
export function startedOn(req: ScheduleRequest, sends: SendRecord[]): string | null {
  if (req.round < 1 || !req.contact_id) return null;
  const mine = sends
    .filter((s) => s.contact_id === req.contact_id
                   && s.campaign_id === req.campaign_id
                   && s.round >= 1
                   && s.status !== "canceled"
                   && s.status !== "failed")
    .sort((a, b) => (a.scheduled_at ?? a.created_at).localeCompare(b.scheduled_at ?? b.created_at));
  return mine[0]?.from_domain ?? null;
}

/** Whether a domain may still carry automated mail. A domain that has been
    switched off or dropped from the config is the one case where a sequence
    has to move: the identity it began on no longer exists, and refusing
    forever would be worse than finishing from somewhere else. */
export function stillUsable(cfg: OutreachConfig, domain: string): boolean {
  const d = domainOf(cfg, domain);
  return Boolean(d?.enabled && !d.manual_only);
}

export type Scheduled = {
  id: string;
  /** Resend's email id, and the cancel token: this message can be pulled back
      with it right up until it goes. Null on a dry run. */
  cancel_token: string | null;
  scheduled_at: string;
  /** The day this send is charged to, or null for a one-off that is not
      charged to any day's budget. */
  quota_day: string | null;
  domain: string;
  used: number;
  cap: number;
  dry_run: boolean;
};

export async function schedule(
  req: ScheduleRequest, cfg: OutreachConfig, queued: SendRecord[],
): Promise<Scheduled> {
  /* Two kinds of recipient. A CRM contact carries provenance and pipeline
     state; a plain address is somebody outside the CRM entirely — a personal
     note, an introduction, a reply to a stranger. Both go through every rule
     below; only the record-keeping differs. */
  let enrichNote: string | null = null;
  const contact = req.contact_id ? await crm.contact(req.contact_id) : null;
  if (req.contact_id && !contact) {
    throw new Refused("no-contact", `no contact with id ${req.contact_id}`, 404);
  }
  /* The one place enrichment is allowed to spend money.

     Not a research sweep and not a background job: we are here because a
     message has been written and confirmed, the recipient is a contact in an
     active campaign, and there is nowhere to send it. That is the moment the
     owner of the budget agreed to pay for, and every other moment is not.

     Everything else about the cost lives in apollo.ts. What lives here is the
     trigger, because the trigger is the expensive part. */
  let to = contact?.email ?? req.to;
  if (!to && contact && req.round >= 1 && !cfg.dry_run && await inActiveCampaign(contact)) {
    const found = await apollo.findEmail(contact).catch((e: unknown) => {
      // A lookup that failed is not a reason to lose the message. Fall
      // through to the ordinary no-address refusal and say what happened.
      enrichNote = e instanceof Error ? e.message : String(e);
      return null;
    });
    if (found?.email) {
      to = found.email;
      // Write it back so the next round, and every panel, has it without a
      // second lookup. The ledger already guarantees we would not pay twice;
      // this makes the address visible to people as well.
      await crm.setEmail(contact.id, found.email).catch(() => undefined);
    } else if (found) {
      enrichNote = found.note;
    }
  }
  if (!to) {
    throw new Refused("no-address",
      contact
        ? `${contact.full_name} has no email address on record` +
          (enrichNote ? ` — ${enrichNote}` : "")
        : "no recipient given");
  }
  if (contact?.email_status === "bounced") {
    throw new Refused("bounced", `${to} has already bounced`);
  }
  /* The opt-out check is on the address, not on the contact.

     Resend's suppression list would stop this too, and it is still written
     to — but only for messages that reach Resend, and only once we have paid
     for whatever enrichment produced the address. Checking here means an
     opted-out person cannot be written to at all, including by hand, including
     from a second contact record that happens to carry the same address. */
  if (await isOptedOut(to)) {
    throw new Refused("opted-out", `${to} has asked not to be contacted again`);
  }
  if (/\{\{|\}\}/.test(`${req.subject}${req.body}`)) {
    throw new Refused("unresolved-placeholder",
      "The message still contains a {{placeholder}}. Fix it before scheduling.");
  }

  /* A sequence keeps the domain it started on.

     Round 2 is threaded onto round 1 with In-Reply-To, so sending it from a
     different domain drops a reply into the conversation from an address the
     recipient has never seen — which reads as a spoof to a person and scores
     like one at the receiving end. It also works against what the cap is
     for: a domain warms on the conversations it is actually carrying, not on
     whichever half-thread had the most headroom that morning.

     pickDomain is therefore consulted only for the first message of a
     sequence. After that the answer was decided the day it began. */
  const sticky = (() => {
    const began = startedOn(req, queued);
    return began && stillUsable(cfg, began) ? began : null;
  })();

  const domain = req.domain ?? sticky ?? (await pickDomain(cfg))?.domain;
  if (!domain) {
    throw new Refused("no-domain-with-room", "Every sending domain has hit its cap for today.", 429);
  }
  const d = domainOf(cfg, domain);
  if (!d) throw new Refused("unknown-domain", `${domain} is not a configured sending domain`);
  if (!d.enabled) throw new Refused("domain-disabled", `${domain} is not enabled`);

  // round 0 is a one-off somebody typed. Anything else is the machine, and
  // the machine does not touch a manual-only domain — that is the whole
  // point of the flag, so it is checked here rather than only in pickDomain.
  if (d.manual_only && req.round !== 0) {
    throw new Refused("manual-only",
      `${domain} is reserved for messages written by hand; a sequence round cannot use it.`);
  }

  /* Sequence mail is paced: inside the sending window, spaced out, because
     that is what protects a young domain. A message somebody just typed is
     not paced — they pressed send and it should go.

     It is still scheduled, a minute out, rather than sent outright: Resend
     will only cancel a message it has not released yet, so that minute is
     the undo. Same reason a mail client waits a few seconds before it
     actually sends. */
  // Rounds 1-3 are unsolicited marketing: paced, and carrying the compliance
  // block. round 0 is a note somebody typed to a person, and is neither.
  const commercial = req.round >= 1;

  const at = req.scheduled_at
    ? new Date(req.scheduled_at)
    : commercial
      ? nextSlot(cfg, domain, queued)
      : new Date(Date.now() + 60 * 1000);
  if (Number.isNaN(at.getTime())) throw new Refused("bad-date", `${req.scheduled_at} is not a date`);

  /* The daily cap is a warm-up budget for cold outreach, so only cold
     outreach spends it. A note somebody typed is not what the mailbox
     providers are judging the domain on, and letting fifteen personal
     replies exhaust the day would stop the sequence for no reason. */
  const day = commercial ? dayKey(at, cfg.timezone) : null;
  const from = fromAddress(cfg, domain);
  if (!from) {
    throw new Refused("unknown-sender",
      `${domain} has no sender defined in SENDERS — adding one is a code change.`);
  }
  const { text, html } = compose(req.body, cfg, req.signature, commercial, to);
  const account = contact ? await crm.account(contact.account_id) : null;
  const now = new Date().toISOString();

  const record: SendRecord = {
    id: randomUUID(),
    account_id: contact?.account_id ?? null,
    contact_id: contact?.id ?? null,
    campaign_id: req.campaign_id,
    company: contact?.company ?? account?.company ?? null,
    to,
    from_domain: domain,
    from_address: from,
    reply_to: d.reply_to,
    round: req.round,
    subject: req.subject,
    body: text,
    html,
    template_tier: req.template_tier,
    written_by: req.written_by,
    resend_id: null,
    message_id: null,
    status: "draft",
    last_event: null,
    scheduled_at: at.toISOString(),
    quota_day: day,          // null for a one-off: it was never charged
    created_at: now,
    updated_at: now,
    dry_run: true,
    error: null,
  };

  // A dry run stops here: the row is written so the queue and the heat map
  // show what would have happened, but no quota is claimed and Resend never
  // hears about it. Claiming quota would burn the first live day's budget on
  // messages that were never sent.
  if (cfg.dry_run || !secret("RESEND_API_KEY")) {
    await putSend(record);
    return { id: record.id, cancel_token: null, scheduled_at: record.scheduled_at!,
             quota_day: day, domain, used: 0, cap: capOf(cfg, domain), dry_run: true };
  }

  const cap = capOf(cfg, domain);
  let used = 0;
  if (day) {
    const claimed = await reserve(domain, day, cap);
    if (claimed === null) {
      /* Two different situations, and the caller treats them differently.
         The pool being full ends the day's work; one sequence's own domain
         being full stops that sequence only, and the rest of the run may
         still have somewhere to go. */
      if (domain === sticky) {
        throw new Refused("sequence-domain-full",
          `${domain} carries this sequence and has used its ${cap} sends for ${day}; ` +
          `the follow-up waits rather than moving to another domain.`, 429);
      }
      throw new Refused("cap-reached", `${domain} has already used its ${cap} sends for ${day}.`, 429);
    }
    used = claimed;
  }

  try {
    const { data, error } = await resend().emails.send({
      from, to, subject: req.subject, text, html,
      ...(d.reply_to ? { replyTo: d.reply_to } : {}),
      scheduledAt: at.toISOString(),
      headers: {
        ...listHeaders(cfg, commercial, to),
        ...threadHeaders(req.in_reply_to, req.references),
      },
      tags: [{ name: "round", value: String(req.round) }],
    });
    if (error || !data) throw new Error(error?.message ?? "Resend returned no id");
    await putSend({ ...record, resend_id: data.id, status: "scheduled", dry_run: false });
    return { id: record.id, cancel_token: data.id, scheduled_at: record.scheduled_at!,
             quota_day: day, domain, used, cap, dry_run: false };
  } catch (err) {
    // The slot was claimed before the call, so hand it back — otherwise a
    // Resend outage silently eats the day's budget. Nothing to return for a
    // one-off, which never took one.
    if (day) await release(domain, day);
    await putSend({ ...record, status: "failed", dry_run: false,
                    error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** Pulls a scheduled message back and returns its slot to the day's budget.
    Only possible while Resend still has it queued. */
export async function cancel(id: string): Promise<{ id: string; note: string }> {
  const row = await getSend(id);
  if (!row) throw new Refused("no-send", `no send with id ${id}`, 404);
  if (row.status === "canceled") return { id, note: "already cancelled" };
  if (row.status !== "scheduled" && row.status !== "draft") {
    throw new Refused("too-late",
      `this message is ${row.status}; only a scheduled message can be cancelled`);
  }
  if (row.resend_id) {
    const { error } = await resend().emails.cancel(row.resend_id);
    if (error) throw new Refused("resend-refused", error.message);
  }
  await setStatus(id, "canceled");
  if (!row.dry_run && row.quota_day) await release(row.from_domain, row.quota_day);
  return { id, note: row.resend_id
    ? "cancelled at Resend and the day's slot returned"
    : "dry-run message; nothing was sent" };
}

/** Brings a scheduled message forward to a minute from now.

    Resend has no "reschedule": the id you hold is for a message it is
    holding, and changing when it goes means cancelling that one and handing
    it a new one. So this re-sends the stored record rather than editing it,
    and the record keeps its own id — the thread, the heat map and the
    contact's history all point at that, and rewriting them to chase a new
    Resend id would be a much larger blast radius than this deserves.

    Still scheduled, not sent. Sixty seconds is what keeps cancel working, and
    on cold mail that undo is worth more than the minute. */
export async function sendNow(
  id: string, cfg: OutreachConfig,
): Promise<{ id: string; scheduled_at: string; note: string }> {
  const row = await getSend(id);
  if (!row) throw new Refused("no-send", `no send with id ${id}`, 404);
  if (row.status !== "scheduled" && row.status !== "draft") {
    throw new Refused("too-late",
      `this message is ${row.status}; only a scheduled message can be brought forward`);
  }
  const at = new Date(Date.now() + 60 * 1000);
  const now = new Date().toISOString();

  if (row.dry_run) {
    await putSend({ ...row, scheduled_at: at.toISOString(), updated_at: now });
    return { id, scheduled_at: at.toISOString(), note: "dry run — nothing will actually be sent" };
  }

  // Cancel first. If the re-send then fails we have stopped a message rather
  // than sent it twice, which is the right way round to fail.
  if (row.resend_id) {
    const { error } = await resend().emails.cancel(row.resend_id);
    if (error) throw new Refused("resend-refused", error.message);
  }

  const commercial = row.round >= 1;
  const { data, error } = await resend().emails.send({
    from: row.from_address, to: row.to, subject: row.subject,
    text: row.body, ...(row.html ? { html: row.html } : {}),
    ...(row.reply_to ? { replyTo: row.reply_to } : {}),
    scheduledAt: at.toISOString(),
    headers: listHeaders(cfg, commercial, row.to),
    tags: [{ name: "round", value: String(row.round) }],
  });
  if (error || !data) {
    await putSend({ ...row, status: "failed", error: error?.message ?? "Resend returned no id",
                    updated_at: now });
    throw new Refused("resend-refused", error?.message ?? "Resend returned no id");
  }

  await putSend({ ...row, resend_id: data.id, status: "scheduled",
                  scheduled_at: at.toISOString(), error: null, updated_at: now });
  return { id, scheduled_at: at.toISOString(), note: "going out in about a minute" };
}

/** Pulls back everything still queued for one address.

    The opt-out path's other half: suppressing an address stops the *next*
    message, but a sequence that is already scheduled would keep landing for
    another week, which is precisely the experience somebody clicking
    unsubscribe is trying to end. Failures are counted, not thrown — one
    message Resend has already released must not stop the rest being pulled. */
export async function cancelAllTo(email: string): Promise<{ canceled: number; failed: number }> {
  const addr = email.trim().toLowerCase();
  const bare = (a: string) => (a.match(/<([^>]+)>/)?.[1] ?? a).trim().toLowerCase();
  const queued = (await allSends()).filter(
    (s) => bare(s.to) === addr && (s.status === "scheduled" || s.status === "draft"));
  let canceled = 0, failed = 0;
  for (const row of queued) {
    try { await cancel(row.id); canceled++; } catch { failed++; }
  }
  return { canceled, failed };
}
