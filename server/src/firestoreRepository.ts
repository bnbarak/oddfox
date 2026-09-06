import { db } from "./firebaseApp.js";
import {
  type AccountPatch,
  AccountRecord,
  type AccountsFile,
  PIPELINE_STATUSES,
  type ContactPatch,
  ContactRecord,
  type ContactsFile,
  type SequencesFile,
  SequencesFile as SequencesFileSchema,
} from "./schemas.js";
import type { CrmRepository } from "./repository.js";

const ACCOUNTS = "crmAccounts";
const CONTACTS = "crmContacts";
const META = "crmMeta";
const SEQUENCES_DOC = "sequences";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Same contract as JsonFileCrmRepository, backed by Firestore instead of a
    file on disk — this is the production repository (see index.ts). Each
    account/contact is its own document, keyed by its existing `id`, so a
    patch is a single document read-modify-write with no cross-record lock
    needed (Firestore documents update atomically on their own). */
export class FirestoreCrmRepository implements CrmRepository {
  async getAccounts(): Promise<AccountsFile> {
    const snap = await db().collection(ACCOUNTS).get();
    const records = snap.docs
      .map((d) => AccountRecord.parse(d.data()))
      .sort((a, b) => a.tier - b.tier || a.company.localeCompare(b.company));
    return {
      dataset: "crm-accounts",
      title: "Accounts",
      updated: today(),
      description: "One row per target company. Pipeline state lives in Firestore.",
      pipeline: [...PIPELINE_STATUSES],
      records,
    };
  }

  async patchAccount(id: string, patch: AccountPatch): Promise<AccountRecord | null> {
    const ref = db().collection(ACCOUNTS).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const merged = AccountRecord.parse({ ...snap.data(), ...patch });
    await ref.set(merged);
    return merged;
  }

  async getContacts(): Promise<ContactsFile> {
    const snap = await db().collection(CONTACTS).get();
    const records = snap.docs
      .map((d) => ContactRecord.parse(d.data()))
      .sort((a, b) => a.priority - b.priority || a.full_name.localeCompare(b.full_name));
    return {
      dataset: "crm-contacts",
      title: "People",
      updated: today(),
      records,
    };
  }

  async patchContact(id: string, patch: ContactPatch): Promise<ContactRecord | null> {
    const ref = db().collection(CONTACTS).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const merged = ContactRecord.parse({ ...snap.data(), ...patch });
    await ref.set(merged);
    return merged;
  }

  async getSequences(): Promise<SequencesFile> {
    const snap = await db().collection(META).doc(SEQUENCES_DOC).get();
    if (!snap.exists) {
      throw new Error(`${META}/${SEQUENCES_DOC} is missing — run npm run migrate first`);
    }
    return SequencesFileSchema.parse(snap.data());
  }
}
