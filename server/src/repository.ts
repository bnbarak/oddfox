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
  getContacts(): Promise<ContactsFile>;
  patchContact(id: string, patch: ContactPatch): Promise<ContactRecord | null>;
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

  async getSequences(): Promise<SequencesFile> {
    return readJson(crmPath("sequences.json"), SequencesFile);
  }
}
