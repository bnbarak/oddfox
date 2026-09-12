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

/** ALREADY_EXISTS, and nothing else. A create that failed because the caller
    cannot write at all must not come back looking like a name clash. */
function taken(err: unknown): boolean {
  return (err as { code?: number })?.code === 6;
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

  /** `create` rather than `set`: Firestore fails the write if the document
      is already there, so two callers racing on the same slug cannot end
      with one silently overwriting a researched row. */
  async createAccount(rec: AccountRecord): Promise<AccountRecord | null> {
    const parsed = AccountRecord.parse(rec);
    try {
      await db().collection(ACCOUNTS).doc(parsed.id).create(parsed);
    } catch (err) {
      if (taken(err)) return null;
      throw err;
    }
    return parsed;
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

  async createContact(rec: ContactRecord): Promise<ContactRecord | null> {
    const parsed = ContactRecord.parse(rec);
    try {
      await db().collection(CONTACTS).doc(parsed.id).create(parsed);
    } catch (err) {
      if (taken(err)) return null;
      throw err;
    }
    /* The account carries its own list of its people, and the Accounts page
       counts it. A contact whose account never learned about it is a person
       who exists on the People page and nowhere else. */
    if (parsed.account_id) {
      const ref = db().collection(ACCOUNTS).doc(parsed.account_id);
      const snap = await ref.get();
      if (snap.exists) {
        const a = AccountRecord.parse(snap.data());
        if (!a.contacts.includes(parsed.id)) {
          await ref.set({ ...a, contacts: [...a.contacts, parsed.id].sort() });
        }
      }
    }
    return parsed;
  }

  async getSequences(): Promise<SequencesFile> {
    const snap = await db().collection(META).doc(SEQUENCES_DOC).get();
    if (!snap.exists) {
      throw new Error(`${META}/${SEQUENCES_DOC} is missing — run npm run migrate first`);
    }
    return SequencesFileSchema.parse(snap.data());
  }
}
