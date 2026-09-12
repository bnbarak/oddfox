import {
  type AccountPatch,
  type AccountRecord,
  AccountsFile,
  type ContactPatch,
  type ContactRecord,
  ContactsFile,
  SequencesFile,
} from "./schemas.js";
import { crmPath, readJson, withFileLock, writeJsonAtomic } from "./store.js";

/** Everything a route handler needs from persistence. Swap the JSON-file
    implementation below for a Mongo-backed one later without touching
    index.ts or the zod schemas — routes only ever see this interface. */
export interface CrmRepository {
  getAccounts(): Promise<AccountsFile>;
  patchAccount(id: string, patch: AccountPatch): Promise<AccountRecord | null>;
  /** Writes a whole new account. Unlike patchAccount this is not limited to
      the working fields — a row that does not exist yet has no researched
      fields to protect. Refuses an id that is already taken rather than
      overwriting the row somebody researched. */
  createAccount(rec: AccountRecord): Promise<AccountRecord | null>;
  getContacts(): Promise<ContactsFile>;
  patchContact(id: string, patch: ContactPatch): Promise<ContactRecord | null>;
  /** Writes a whole new contact, and adds it to its account's `contacts`
      list, which is what the Accounts page counts. Same refusal on a taken
      id. */
  createContact(rec: ContactRecord): Promise<ContactRecord | null>;
  getSequences(): Promise<SequencesFile>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class JsonFileCrmRepository implements CrmRepository {
  async getAccounts(): Promise<AccountsFile> {
    return readJson(crmPath("accounts.json"), AccountsFile);
  }

  patchAccount(id: string, patch: AccountPatch): Promise<AccountRecord | null> {
    const path = crmPath("accounts.json");
    return withFileLock(path, async () => {
      const file = await readJson(path, AccountsFile);
      const idx = file.records.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      const merged = { ...file.records[idx]!, ...patch };
      file.records[idx] = merged;
      file.updated = today();
      await writeJsonAtomic(path, file);
      return merged;
    });
  }

  createAccount(rec: AccountRecord): Promise<AccountRecord | null> {
    const path = crmPath("accounts.json");
    return withFileLock(path, async () => {
      const file = await readJson(path, AccountsFile);
      if (file.records.some((r) => r.id === rec.id)) return null;
      file.records.push(rec);
      file.updated = today();
      await writeJsonAtomic(path, file);
      return rec;
    });
  }

  async getContacts(): Promise<ContactsFile> {
    return readJson(crmPath("contacts.json"), ContactsFile);
  }

  patchContact(id: string, patch: ContactPatch): Promise<ContactRecord | null> {
    const path = crmPath("contacts.json");
    return withFileLock(path, async () => {
      const file = await readJson(path, ContactsFile);
      const idx = file.records.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      const merged = { ...file.records[idx]!, ...patch };
      file.records[idx] = merged;
      file.updated = today();
      await writeJsonAtomic(path, file);
      return merged;
    });
  }

  createContact(rec: ContactRecord): Promise<ContactRecord | null> {
    const path = crmPath("contacts.json");
    return withFileLock(path, async () => {
      const file = await readJson(path, ContactsFile);
      if (file.records.some((r) => r.id === rec.id)) return null;
      file.records.push(rec);
      file.updated = today();
      await writeJsonAtomic(path, file);
      return rec;
    }).then(async (written) => {
      if (written && rec.account_id) await this.link(rec.account_id, rec.id);
      return written;
    });
  }

  /** The account's own list of its people, kept in step. Separate file, so
      separate lock — a contact written without the link showing up is the
      failure to prefer over a link pointing at no contact. */
  private link(accountId: string, contactId: string): Promise<void> {
    const path = crmPath("accounts.json");
    return withFileLock(path, async () => {
      const file = await readJson(path, AccountsFile);
      const a = file.records.find((r) => r.id === accountId);
      if (!a || a.contacts.includes(contactId)) return;
      a.contacts = [...a.contacts, contactId].sort();
      file.updated = today();
      await writeJsonAtomic(path, file);
    });
  }

  async getSequences(): Promise<SequencesFile> {
    return readJson(crmPath("sequences.json"), SequencesFile);
  }
}
