import { FirestoreCrmRepository } from "../firestoreRepository.js";
import type { AccountRecord, ContactRecord } from "../schemas.js";

/* Read access to the researched CRM, which stays in Firestore.

   The split is deliberate: accounts, contacts and sequence copy are edited by
   people and by research passes, and Firestore is where the rest of the app
   already reads them. Postgres holds only what this engine generates. Nothing
   here writes — pipeline status changes go through the existing PATCH routes
   so there is one code path for them. */

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
