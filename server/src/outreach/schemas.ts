import { z } from "zod";

/* Types for the automated outreach engine. Kept in their own file rather than
   folded into ../schemas.ts because that file is the *researched* CRM record
   shape, which several people edit by hand; this one is machine-written
   operational state and nobody edits it by hand. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

// ---- Configuration --------------------------------------------------------

/** One sending domain. The daily cap is per domain, not per account and not
    per mailbox: warming a domain is what the cap protects, so two mailboxes
    on the same domain share one budget. */
export const SendingDomain = z.object({
  /** Bare domain, no scheme, no @ — e.g. "seaworth.ai". Must be verified in Resend. */
  domain: z.string().min(3),
  /** Local part of the from address, e.g. "barak" for barak@seaworth.ai. */
  from_local: z.string().min(1),
  /** Display name shown in the recipient's client. */
  from_name: z.string().min(1),
  /** Where replies go. Defaults to the from address. */
  reply_to: z.string().email().nullable().default(null),
  /** Hard ceiling on messages this domain may send in one day. */
  daily_cap: z.number().int().positive().default(15),
  /** A domain that is not enabled is never picked and never sends. */
  enabled: z.boolean().default(true),
  /** Reserved for messages a person wrote by hand.

      The automated side never picks it: not for a sequence round, not for a
      follow-up, not when every other domain is full. A personal domain earns
      its reputation over years of ordinary mail and can lose it in a week of
      cold outreach, and the two must not share a sending identity. */
  manual_only: z.boolean().default(false),
  /** Whether inbound mail to this domain is pulled into the CRM.

      The MX record is at the apex, so Resend receives mail for *every*
      address at a domain — not just the one we send from. For an
      outreach-only domain that is what we want. For a personal domain it
      would drag private correspondence into a shared database and onto a
      page other people can read, so it is off wherever manual_only is on. */
  listen_inbound: z.boolean().default(true),
  /** Free text — why this domain exists, when it was warmed, anything a human needs. */
  note: z.string().nullable().default(null),
});
export type SendingDomain = z.infer<typeof SendingDomain>;

export const OutreachConfig = z.object({
  /** Empty until the domains are supplied. Empty means nothing can send. */
  domains: z.array(SendingDomain).default([]),
  /** Cap applied to a domain that does not set its own. */
  default_daily_cap: z.number().int().positive().default(15),
  /** IANA zone that decides where one sending day ends and the next begins. */
  timezone: z.string().default("UTC"),
  /** Signed at the bottom of every message when no signature is chosen. */
  sender_name: z.string().default("Barak"),
  /** Sign-offs to pick from when writing. The postal address and the opt-out
      line are NOT part of these — they are appended after whichever one is
      used, because they are a legal requirement and must not be removable by
      editing a signature. */
  signatures: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    body: z.string().max(2000),
  })).default([]),
  /** Which signature is used when the writer does not choose. */
  default_signature: z.string().nullable().default(null),
  /** Individual addresses whose inbound mail is pulled into the CRM even
      when their domain is not listened to.

      Per-address rather than per-domain because the MX record is at the
      apex: listening to a domain means listening to every address on it.
      This lets one mailbox on a personal domain be tracked without dragging
      the rest of that domain's mail into a shared database. */
  tracked_addresses: z.array(z.string().email()).default([]),
  /** A real postal address is required for lawful commercial email in the
      UK/EU. Sending stays blocked until this is filled in. */
  postal_address: z.string().nullable().default(null),
  /** Mailbox that receives opt-outs; also the List-Unsubscribe target. */
  unsubscribe_mailbox: z.string().email().nullable().default(null),
  /** Master switch. True means drafts are produced and logged but nothing
      reaches Resend. Starts true and must be turned off deliberately. */
  dry_run: z.boolean().default(true),
  /** Earliest and latest local hour a message may be scheduled to land. */
  send_window: z.object({ start_hour: z.number().int().min(0).max(23).default(8),
                          end_hour: z.number().int().min(1).max(23).default(17) }).default({ start_hour: 8, end_hour: 17 }),
  /** When on, the heartbeat writes and schedules the next round by itself for
      anyone who is due one and has not replied. Off means it only reports
      what is due and waits for a person. */
  auto_followups: z.boolean().default(false),
  /** Days between rounds, mirroring sequences.json's cadence block. */
  cadence_days: z.object({ round_2: z.number().int().positive().default(4),
                           round_3: z.number().int().positive().default(7) }).default({ round_2: 4, round_3: 7 }),
  /** Mastra model-router id, `provider/model`. Google needs GOOGLE_API_KEY
      in the environment; the router reads it itself.

      Not a `-preview` model on purpose. gemini-2.5-pro was the first choice
      and the API refused it — "no longer available to new users" — which is
      exactly how a preview model ends too, except later and in production.
      google/gemini-3.1-pro-preview also works today if you want more care in
      the writing; it is one config edit and no deploy. */
  model: z.string().default("google/gemini-3.8-flash"),
  updated: z.string().default(""),
});
export type OutreachConfig = z.infer<typeof OutreachConfig>;

/** The subset of the config a request actually asked to change.

    `OutreachConfig.partial()` is NOT that subset. Every field here carries a
    `.default()`, and `.partial()` does not strip defaults — it makes the key
    optional and then fills the absent one in. Parsing `{signatures: [...]}`
    therefore hands back a complete object in which `domains` is `[]`,
    `dry_run` is `true` and `postal_address` is `null`, which spread over the
    stored config erases all three. That is how saving a signature twice took
    the whole system offline.

    So the raw body decides which keys count. Only the keys the caller
    actually sent survive; the parse still validates their values. */
export function configPatch(raw: unknown): Partial<OutreachConfig> {
  const parsed = OutreachConfig.partial().parse(raw);
  const sent = new Set(Object.keys((raw ?? {}) as Record<string, unknown>));
  return Object.fromEntries(
    Object.entries(parsed).filter(([k, v]) => sent.has(k) && v !== undefined),
  ) as Partial<OutreachConfig>;
}


// ---- The send ledger ------------------------------------------------------

export const SEND_STATUSES = [
  "draft",        // written, not scheduled
  "scheduled",    // accepted by Resend, has a cancel token, has not gone yet
  "canceled",     // we pulled it back before it went
  "sent",         // handed to the recipient's server
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "failed",
] as const;
export const SendStatus = z.enum(SEND_STATUSES);
export type SendStatus = z.infer<typeof SendStatus>;

/** One row per message we have written, whether or not it was ever sent.
    Doc id is our own `id`, not Resend's, so a draft exists before Resend does. */
export const SendRecord = z.object({
  id: z.string().min(1),
  account_id: z.string().nullable(),
  contact_id: z.string().nullable(),
  /** The campaign that produced this message, or null for one written by
      hand and for anything sent before campaigns recorded themselves.

      This is what makes campaigns independent. Attributing a send to a
      campaign by account instead — "this campaign contains that account, so
      this send is ours" — means every campaign inherits every message ever
      sent to those companies: a campaign created this morning reports
      yesterday's sends as its own, two campaigns on one account both claim
      the same message, and activation skips people because *some other*
      campaign already wrote to them. All four were live bugs. A send belongs
      to exactly one campaign or to none, and null never means "match on
      account after all". */
  campaign_id: z.string().nullable().default(null),
  company: z.string().nullable(),
  to: z.string().email(),
  /** The rest of a group message written by hand: further To addresses, Cc
      and Bcc. `to` stays the first person, which is who the thread, the
      history and the contact record are filed under. Optional because no
      record written before group mail has them. */
  also_to: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  from_domain: z.string(),
  from_address: z.string(),
  reply_to: z.string().nullable(),
  /** 1–3 are sequence rounds. 0 is a one-off written by hand, which is why
      it never advances the cadence and never triggers a follow-up. */
  round: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  subject: z.string(),
  /** The plain-text part, footer included: exactly what was handed to Resend. */
  body: z.string(),
  /** The HTML part, likewise verbatim. Nullable because every message written
      before there was an HTML part has none, and because a record is what was
      actually sent — regenerating it from `body` on read would show today's
      footer on a message that went out with last month's. */
  html: z.string().nullable().default(null),
  /** How the copy was produced — which template, and whether the agent wrote it. */
  template_tier: z.number().int().nullable(),
  written_by: z.enum(["template", "agent"]),
  /** Resend's email id. This is the cancel token: a scheduled email can be
      pulled back with it right up until it goes. Null until scheduled. */
  resend_id: z.string().nullable(),
  /** RFC message id, used to tie an inbound reply back to this send. */
  message_id: z.string().nullable(),
  status: SendStatus,
  /** Resend's own last_event, kept verbatim so we never lose detail by
      squashing it into our narrower status enum. */
  last_event: z.string().nullable(),
  /** ISO instant the message is due to land. */
  scheduled_at: z.string().nullable(),
  /** The day this send is charged to, in config.timezone. This is what the
      daily cap counts — the day it lands, not the day it was booked. */
  quota_day: isoDate.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  /** True when the message was never handed to Resend because dry_run was on. */
  dry_run: z.boolean(),
  error: z.string().nullable(),
});
export type SendRecord = z.infer<typeof SendRecord>;

// ---- Incoming -------------------------------------------------------------

export const ReplyRecord = z.object({
  id: z.string().min(1),            // Resend's received-email id
  from: z.string(),
  to: z.array(z.string()),
  subject: z.string().nullable(),
  received_at: z.string(),
  /** Which of our sends this answers, when we could work it out. */
  send_id: z.string().nullable(),
  account_id: z.string().nullable(),
  contact_id: z.string().nullable(),
  /** The body on one line, for previews and tooltips. */
  excerpt: z.string().nullable(),
  /** The body as written, line breaks kept — what the Inbox shows. */
  text: z.string().nullable().optional(),
  /** Set when the text reads as an opt-out. Such a reply also writes a
      suppression entry, so the address can never be picked again. */
  unsubscribe: z.boolean(),
  /** Set when the sender looks automated (out of office, mailer-daemon), so a
      bounce message is not mistaken for a human reply. */
  automated: z.boolean(),
});
export type ReplyRecord = z.infer<typeof ReplyRecord>;

export const SuppressionRecord = z.object({
  email: z.string(),
  reason: z.enum(["requested", "bounced", "complained", "manual"]),
  at: z.string(),
  note: z.string().nullable(),
});
export type SuppressionRecord = z.infer<typeof SuppressionRecord>;

// ---- Request bodies -------------------------------------------------------

export const DraftRequest = z.object({
  contact_id: z.string().min(1),
  round: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Off means fill the template's variables and nothing more. On lets the
      agent rewrite it for this person. */
  use_agent: z.boolean().default(true),
  /** Extra steer for the agent — "mention the Aden transit", say. */
  guidance: z.string().max(2000).nullable().default(null),
}).strict();
export type DraftRequest = z.infer<typeof DraftRequest>;

export const ScheduleRequest = z.object({
  /** A CRM contact, when there is one. */
  contact_id: z.string().min(1).nullable().default(null),
  /** A plain address, for someone not in the CRM. Ignored when contact_id
      is given. One of the two is required. */
  to: z.string().email().nullable().default(null),
  /** Group mail, written by hand only (round 0): further people on To, and
      Cc and Bcc. The first recipient above stays the one the conversation is
      filed under. Every address here is checked against the opt-out list. */
  also_to: z.array(z.string().email()).optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  /** 0 for a one-off message written by hand; 1–3 for a sequence round. */
  round: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  /** Which campaign this message belongs to. Null for a one-off. Callers on
      the campaign path must set it — see SendRecord.campaign_id for why the
      alternative does not work. */
  campaign_id: z.string().nullable().default(null),
  subject: z.string().min(1),
  body: z.string().min(1),
  /** The same message as formatted HTML, from the composer's editor. Hand-
      written mail (round 0) only — a sequence round is plain text. The
      server cleans it against a short allowlist and derives the plain-text
      part from it, so the two halves of the message cannot disagree. */
  html: z.string().max(200_000).nullable().optional(),
  /** ISO instant, or omitted for the next free slot inside the send window. */
  scheduled_at: z.string().nullable().default(null),
  /** Which sending domain to charge this to. Omitted picks the enabled
      domain with the most headroom left today. */
  domain: z.string().nullable().default(null),
  written_by: z.enum(["template", "agent"]).default("agent"),
  template_tier: z.number().int().nullable().default(null),
  /** Which sign-off to use. Omitted uses the configured default. */
  signature: z.string().nullable().default(null),
  /** The Message-ID this answers, and the ids already in the conversation.
      Without these a reply arrives as a brand-new conversation, because
      In-Reply-To and References are the only thing mail clients thread on —
      a matching subject is not enough. */
  in_reply_to: z.string().nullable().default(null),
  references: z.array(z.string()).default([]),
}).strict().refine((r) => r.contact_id ?? r.to, {
  message: "either contact_id or to is required",
}).refine((r) => 1 + (r.also_to?.length ?? 0) + (r.cc?.length ?? 0) + (r.bcc?.length ?? 0) <= 50, {
  // Resend's own limit for one message.
  message: "at most 50 recipients on one message",
});
export type ScheduleRequest = z.infer<typeof ScheduleRequest>;

// ---- Campaigns --------------------------------------------------------

/** A persona and a message aimed at a chosen set of accounts, independent
    of those accounts' own tier. Companies and campaigns are orthogonal by
    design: an account's tier still exists and means what it always meant,
    but a campaign can borrow any tier's copy for any accounts, so the same
    company can be reached with a different argument without reclassifying
    it, and the same persona can run across accounts of different tiers. */
export const Campaign = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  persona: z.string().min(1),
  /** Which sequences.json tier's copy this campaign's message borrows —
      no separate content schema needed for a new persona. */
  template_tier: z.number().int(),
  account_ids: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  created_at: z.string().default(""),
  /** Soft delete. The row stays because the sends it produced point back at
      it: a message in someone's thread with a campaign id that resolves to
      nothing is worse than a campaign nobody can see. Set means hidden
      everywhere; the drafting path and the panels both filter on it. */
  deleted_at: z.string().nullable().default(null),
}).strict();
export type Campaign = z.infer<typeof Campaign>;
