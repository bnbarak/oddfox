import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import * as crm from "./crm.js";
import { capOf, domainOf, fromAddress, secret } from "./config.js";
import { listHeaders, withFooter } from "./render.js";
import { getSend, pickDomain, putSend, release, reserve, setStatus } from "./store.js";
import type { OutreachConfig, ScheduleRequest, SendRecord } from "./schemas.js";
import { dayKey, nextInWindow } from "./time.js";

/* Scheduling a message — the only path to Resend.

   Nothing is ever sent immediately, even when the slot is two minutes away.
   Everything goes out with a `scheduled_at`, which means Resend holds it and
   returns an id that will cancel it. That id is the whole reason a mistake
   caught in the next twenty minutes costs nothing.

   Note what is NOT here: an opt-out list. Resend keeps one, adds to it
   automatically on every bounce and complaint, and skips sending to anything
   on it across the whole team. Reimplementing that would only give us a
   second list to disagree with the first. */

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
  const contact = req.contact_id ? await crm.contact(req.contact_id) : null;
  if (req.contact_id && !contact) {
    throw new Refused("no-contact", `no contact with id ${req.contact_id}`, 404);
  }
  const to = contact?.email ?? req.to;
  if (!to) {
    throw new Refused("no-address",
      contact ? `${contact.full_name} has no email address on record` : "no recipient given");
  }
  if (contact?.email_status === "bounced") {
    throw new Refused("bounced", `${to} has already bounced`);
  }
  if (/\{\{|\}\}/.test(`${req.subject}${req.body}`)) {
    throw new Refused("unresolved-placeholder",
      "The message still contains a {{placeholder}}. Fix it before scheduling.");
  }

  const domain = req.domain ?? (await pickDomain(cfg))?.domain;
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
  const text = withFooter(req.body, cfg, req.signature, commercial);
  const account = contact ? await crm.account(contact.account_id) : null;
  const now = new Date().toISOString();

  const record: SendRecord = {
    id: randomUUID(),
    account_id: contact?.account_id ?? null,
    contact_id: contact?.id ?? null,
    company: contact?.company ?? account?.company ?? null,
    to,
    from_domain: domain,
    from_address: from,
    reply_to: d.reply_to,
    round: req.round,
    subject: req.subject,
    body: text,
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
      throw new Refused("cap-reached", `${domain} has already used its ${cap} sends for ${day}.`, 429);
    }
    used = claimed;
  }

  try {
    const { data, error } = await resend().emails.send({
      from, to, subject: req.subject, text,
      ...(d.reply_to ? { replyTo: d.reply_to } : {}),
      scheduledAt: at.toISOString(),
      headers: {
        ...listHeaders(cfg, commercial),
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
