import { z } from "zod";

/** Mirrors data/json/crm/accounts.json's "pipeline" array exactly.
    If that array changes, this must change with it. */
export const PIPELINE_STATUSES = [
  "not started",
  "queued",
  "round 1 sent",
  "round 2 sent",
  "round 3 sent",
  "replied",
  "meeting",
  "won",
  "dead",
] as const;
export const PipelineStatus = z.enum(PIPELINE_STATUSES);
export type PipelineStatus = z.infer<typeof PipelineStatus>;

export const BuyingRole = z.enum([
  "technical-manager",
  "commercial-manager",
  "beneficial-owner",
  "charterer",
  "registered-owner",
  "other",
]);
export type BuyingRole = z.infer<typeof BuyingRole>;

export const EmailStatus = z.enum(["unknown", "guessed", "verified", "bounced"]);
export type EmailStatus = z.infer<typeof EmailStatus>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const SequenceDates = z.object({
  round_1: isoDate.nullable(),
  round_2: isoDate.nullable(),
  round_3: isoDate.nullable(),
});
export type SequenceDates = z.infer<typeof SequenceDates>;

// ---- Accounts ---------------------------------------------------------

export const AccountRecord = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  tier_name: z.string(),
  buying_roles: z.array(BuyingRole),
  country: z.string().nullable(),
  fleet: z.number().int().nonnegative().nullable(),
  vessel_attacked: z.array(z.string()).nullable(),
  url: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  head_office: z.string().nullable(),
  reachable: z.boolean(),
  status: PipelineStatus,
  owner: z.string().nullable(),
  /** Operator-set flag for "watch this one". Working state, not research —
      so it is patchable from the UI, unlike company, tier or fleet. */
  starred: z.boolean().default(false),
  last_touch: isoDate.nullable(),
  sequence: SequenceDates,
  contacts: z.array(z.string()),
  notes: z.string().nullable(),
  source_ids: z.array(z.string()),
});
export type AccountRecord = z.infer<typeof AccountRecord>;

export const AccountsFile = z.object({
  dataset: z.literal("crm-accounts"),
  title: z.string(),
  updated: isoDate,
  description: z.string(),
  pipeline: z.array(z.string()),
  records: z.array(AccountRecord),
});
export type AccountsFile = z.infer<typeof AccountsFile>;

/** The only fields this app is allowed to write to an account: working
    pipeline state, never the researched fields (company, tier, fleet, ...). */
export const AccountPatch = z
  .object({
    status: PipelineStatus,
    owner: z.string().nullable(),
    starred: z.boolean(),
    last_touch: isoDate.nullable(),
    sequence: SequenceDates,
    notes: z.string().nullable(),
  })
  .partial()
  .strict();
export type AccountPatch = z.infer<typeof AccountPatch>;

// ---- Contacts -----------------------------------------------------------

export const ContactRecord = z.object({
  id: z.string().min(1),
  account_id: z.string().nullable(),
  company: z.string().nullable(),
  full_name: z.string().min(1),
  title: z.string(),
  role_class: z.string(),
  buying_role: BuyingRole,
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  location: z.string().optional(),
  background: z.string().optional(),
  connection_degree: z.union([z.literal(1), z.literal(2)]).optional(),
  connection_note: z.string().optional(),
  linkedin_url: z.string().nullable(),
  linkedin_source: z.string().nullable().optional(),
  email: z.string().email().nullable(),
  email_status: EmailStatus,
  /** Corporate direct dial only. The collection policy in contacts.json
      forbids storing personal or mobile numbers, so there is deliberately
      no field for one. */
  phone_office: z.string().nullable().optional(),
  starred: z.boolean().default(false),
  source_url: z.string().nullable(),
  source: z.string().optional(),
  published: z.string().nullable().optional(),
  retrieved: isoDate,
  status: PipelineStatus,
  sequence: SequenceDates,
  replied: z.boolean(),
  notes: z.string().nullable(),
});
export type ContactRecord = z.infer<typeof ContactRecord>;

export const ContactsFile = z.object({
  dataset: z.literal("crm-contacts"),
  title: z.string(),
  updated: isoDate,
  records: z.array(ContactRecord),
}).passthrough();
export type ContactsFile = z.infer<typeof ContactsFile>;

/** The only fields this app is allowed to write to a contact. Identity and
    provenance fields (name, title, source, retrieved, ...) are researched,
    not edited from the UI. */
export const ContactPatch = z
  .object({
    linkedin_url: z.string().nullable(),
    email: z.string().email().nullable(),
    email_status: EmailStatus,
    status: PipelineStatus,
    sequence: SequenceDates,
    replied: z.boolean(),
    starred: z.boolean(),
    notes: z.string().nullable(),
  })
  .partial()
  .strict();
export type ContactPatch = z.infer<typeof ContactPatch>;

// ---- Sequences (read-only) ------------------------------------------------

export const SequencesFile = z.object({
  dataset: z.literal("crm-sequences"),
  title: z.string(),
  updated: isoDate,
}).passthrough();
export type SequencesFile = z.infer<typeof SequencesFile>;
