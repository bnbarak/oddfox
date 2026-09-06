import { DB, type Rec } from "../../../data";
import { type Tone } from "../../../ui";
import {
  useCrmAccounts, useCrmContacts,
  type AccountRecord, type ContactRecord,
} from "../../../lib/crmStore";

export const PIPE = ["not started", "queued", "round 1 sent", "round 2 sent", "round 3 sent",
                     "replied", "meeting", "won", "dead"] as const;

export const TONE: Record<string, Tone> = {
  "not started": "", queued: "cool", "round 1 sent": "warm", "round 2 sent": "warm",
  "round 3 sent": "warm", replied: "calm", meeting: "calm", won: "calm", dead: "hot",
};

export const today = () => new Date().toISOString().slice(0, 10);

/** Where a company row points: its own site, else its LinkedIn page, else nowhere. */
export const link = (r: { url: string | null; linkedin_url?: string | null }): string | null =>
  r.url ?? r.linkedin_url ?? null;

/* The file-level metadata (gaps, role_map, target, ...) is not pipeline state, so it
   stays a build-time import. Only the records come from the server. */
export const accountsFile = DB.crmAccounts as unknown as Rec;
export const contactsFile = DB.crmContacts as unknown as Rec;
export const sequencesFile = DB.crmSequences as unknown as Rec;

/** Records off the server when it is up, off the bundled file when it is not.
    The panel stays readable either way; `live` gates the editing controls. */
export function useAccounts() {
  const { records, error, patch } = useCrmAccounts();
  return {
    rows: records ?? (accountsFile.records as AccountRecord[]),
    live: records !== null, error, patch,
  };
}

export function useContacts() {
  const { records, error, patch } = useCrmContacts();
  return {
    rows: records ?? (contactsFile.records as ContactRecord[]),
    live: records !== null, error, patch,
  };
}
