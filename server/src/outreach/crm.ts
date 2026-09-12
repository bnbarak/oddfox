import { FirestoreCrmRepository } from "../firestoreRepository.js";
import type { AccountRecord, ContactRecord } from "../schemas.js";

/* Read access to the researched CRM, which stays in Firestore.

   The split is deliberate: accounts, contacts and sequence copy are edited by
   people and by research passes, and Firestore is where the rest of the app
   already reads them. Postgres holds only what this engine generates. This file is read-only
   apart from setEmail and the two add* functions below — pipeline status
   changes go through the existing PATCH routes so there is one code path for
   them. */

const repo = new FirestoreCrmRepository();

export type SequenceRound = { round: number; subject: string; body: string; variant?: string };
export type Sequence = { tier: number; tier_name: string; premise?: string; channel?: string;
                         rounds: SequenceRound[] };

export const accounts = async (): Promise<AccountRecord[]> => (await repo.getAccounts()).records;
export const contacts = async (): Promise<ContactRecord[]> => (await repo.getContacts()).records;

export async function contact(id: string): Promise<ContactRecord | null> {
  return (await contacts()).find((c) => c.id === id) ?? null;
}

export async function account(id: string | null): Promise<AccountRecord | null> {
  if (!id) return null;
  return (await accounts()).find((a) => a.id === id) ?? null;
}

/** Writes back an address we did not have before.

    The one exception to "nothing here writes". Pipeline status changes go
    through the PATCH routes so there is a single code path for them, but an
    address discovered mid-send is different: we have already paid for it, and
    if it is not written down here it is invisible to every person looking at
    the People page and gets looked up again by the next thing that needs it.
    `email_status` stays untouched — found is not the same as verified, and
    only a bounce or a delivery should move it. */
export async function setEmail(id: string, email: string): Promise<void> {
  await repo.patchContact(id, { email });
}

/* ---- Adding a row ------------------------------------------------------

   Everyone in the CRM arrived from a research pass, which is why nothing here
   could write one. But the people worth adding next are the ones the CRM
   itself turns up: an out-of-office naming the desk that covers while someone
   is away, a reply that says "talk to my colleague". Making the operator say
   "add them through the UI" to something it is reading out loud is a silly
   place to stop.

   A hand-added row is still marked as one — `source` says so, `retrieved` is
   today — so a later research pass can tell the two apart. */

/** The id shape every researched row already uses: the name, lowercased,
    punctuation dropped, spaces hyphenated. "V.Group" is `vgroup` and
    "Anglo-Eastern" is `anglo-eastern`, both of which this reproduces. */
export function slug(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    /* NFD takes the ring off \u00c5 but leaves \u00f8 and \u00e6 alone \u2014 they are letters,
       not accented o and a. Shipping is full of Danish and Norwegian names,
       and "s-ren" for S\u00f8ren is not an id anybody would type. */
    .replace(/\u00f8/g, "o").replace(/\u00e6/g, "ae").replace(/\u00e5/g, "a")
    .replace(/\u00f0/g, "d").replace(/\u00fe/g, "th").replace(/\u0142/g, "l").replace(/\u00df/g, "ss")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `taken` already holds every id in the collection. A clash gets -2, then
    -3: two people called Chen at one company is ordinary, and refusing the
    second is not an option a person would accept. */
export function freeId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export type NewAccount = {
  company: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  country?: string | null;
  url?: string | null;
  notes?: string | null;
};

/** Adds a company. Returns null if one by that name is already there — the
    caller should say so rather than end up with two of them. */
export async function addAccount(a: NewAccount): Promise<AccountRecord | null> {
  const all = await accounts();
  const id = slug(a.company);
  if (all.some((x) => x.id === id || x.company.toLowerCase() === a.company.toLowerCase())) {
    return null;
  }
  /* The tier's name is whatever the accounts already in that tier call it,
     so a new row joins an existing group instead of inventing a synonym. */
  const tier_name = all.find((x) => x.tier === a.tier)?.tier_name ?? `tier ${a.tier}`;
  return repo.createAccount({
    id, company: a.company, tier: a.tier, tier_name, buying_roles: [],
    country: a.country ?? null, fleet: null, vessel_attacked: null,
    url: a.url ?? null, linkedin_url: null, email: null, phone: null,
    head_office: null, reachable: true, status: "not started", owner: null,
    starred: false, last_touch: null,
    sequence: { round_1: null, round_2: null, round_3: null },
    contacts: [], notes: a.notes ?? null, source_ids: [],
  });
}

export type NewContact = {
  full_name: string;
  account_id: string;
  title?: string | null;
  email?: string | null;
  buying_role?: ContactRecord["buying_role"];
  priority?: 1 | 2 | 3;
  linkedin_url?: string | null;
  notes?: string | null;
};

/** Adds a person to an account that already exists. Returns null if there is
    no such account, and the existing row if that address is already on file
    — the same address twice is two people to every count in the app and two
    messages to one inbox. */
export async function addContact(
  c: NewContact,
): Promise<{ made: ContactRecord } | { already: ContactRecord } | null> {
  const acc = await account(c.account_id);
  if (!acc) return null;
  const all = await contacts();
  const email = c.email?.trim().toLowerCase() || null;
  const dup = email ? all.find((x) => x.email?.toLowerCase() === email) : undefined;
  if (dup) return { already: dup };

  const made = await repo.createContact({
    id: freeId(slug(c.full_name), new Set(all.map((x) => x.id))),
    account_id: acc.id, company: acc.company,
    full_name: c.full_name, title: c.title ?? "", role_class: "unknown",
    buying_role: c.buying_role ?? "other", priority: c.priority ?? 2,
    linkedin_url: c.linkedin_url ?? null,
    email,
    /* Honest about where it came from: somebody typed it, nothing has
       delivered to it yet, and only a bounce or a delivery moves this on. */
    email_status: email ? "guessed" : "unknown",
    source_url: null, source: "added by hand", published: null,
    retrieved: new Date().toISOString().slice(0, 10),
    status: "not started", sequence: { round_1: null, round_2: null, round_3: null },
    replied: false, starred: false, notes: c.notes ?? null,
  });
  return made ? { made } : null;
}

/** The template for one tier and round. Falls back to tier 1 when a tier has
    no sequence of its own, so a new tier never leaves the agent with nothing
    to work from. */
export async function template(tier: number, round: 1 | 2 | 3): Promise<{ seq: Sequence; r: SequenceRound } | null> {
  const file = (await repo.getSequences()) as unknown as { sequences?: Sequence[] };
  const list = file.sequences ?? [];
  const seq = list.find((s) => s.tier === tier) ?? list.find((s) => s.tier === 1);
  if (!seq) return null;
  const r = seq.rounds.find((x) => x.round === round) ?? seq.rounds[0];
  return r ? { seq, r } : null;
}

/** Tier 0 is a LinkedIn sequence, not an email one — sending it as email
    would be wrong on its face ("no subject" is one of its subject lines). */
export const isEmailTier = (tier: number): boolean => tier >= 1;
