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
  /** Signed at the bottom of every message. */
  sender_name: z.string().default("Barak"),
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
  company: z.string().nullable(),
  to: z.string().email(),
  from_domain: z.string(),
  from_address: z.string(),
  reply_to: z.string().nullable(),
  /** 1–3 are sequence rounds. 0 is a one-off written by hand, which is why
      it never advances the cadence and never triggers a follow-up. */
  round: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  subject: z.string(),
  body: z.string(),
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
  /** First part of the body, for the panel. Full text stays in Resend. */
  excerpt: z.string().nullable(),
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
  contact_id: z.string().min(1),
  /** 0 for a one-off message written by hand; 1–3 for a sequence round. */
  round: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  subject: z.string().min(1),
  body: z.string().min(1),
  /** ISO instant, or omitted for the next free slot inside the send window. */
  scheduled_at: z.string().nullable().default(null),
  /** Which sending domain to charge this to. Omitted picks the enabled
      domain with the most headroom left today. */
  domain: z.string().nullable().default(null),
  written_by: z.enum(["template", "agent"]).default("agent"),
  template_tier: z.number().int().nullable().default(null),
}).strict();
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
}).strict();
export type Campaign = z.infer<typeof Campaign>;
