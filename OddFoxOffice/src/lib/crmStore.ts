import { useCallback, useEffect, useRef, useState } from "react";

/** CRM pipeline state now lives in data/json/crm/*.json on disk, owned by
    ../../../server (server/src/index.ts). This module is a thin typed
    client over its /api/crm/* endpoints — no more localStorage, no more
    manual export/paste. Vite proxies /api to that server in dev. */

export type PipelineStatus =
  | "not started"
  | "queued"
  | "round 1 sent"
  | "round 2 sent"
  | "round 3 sent"
  | "replied"
  | "meeting"
  | "won"
  | "dead";

export type SequenceDates = { round_1: string | null; round_2: string | null; round_3: string | null };

export type AccountRecord = {
  id: string;
  company: string;
  tier: 1 | 2 | 3 | 4 | 5;
  tier_name: string;
  buying_roles: string[];
  country: string | null;
  fleet: number | null;
  vessel_attacked: string[] | null;
  url: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  head_office: string | null;
  reachable: boolean;
  status: PipelineStatus;
  owner: string | null;
  last_touch: string | null;
  sequence: SequenceDates;
  contacts: string[];
  notes: string | null;
  source_ids: string[];
};

export type AccountPatch = Partial<
  Pick<AccountRecord, "status" | "owner" | "last_touch" | "sequence" | "notes">
>;

export type EmailStatus = "unknown" | "guessed" | "verified" | "bounced";

export type ContactRecord = {
  id: string;
  account_id: string | null;
  company: string | null;
  full_name: string;
  title: string;
  role_class: string;
  buying_role: string;
  priority: 1 | 2 | 3;
  location?: string;
  background?: string;
  connection_degree?: 1 | 2;
  connection_note?: string;
  linkedin_url: string | null;
  linkedin_source?: string | null;
  email: string | null;
  email_status: EmailStatus;
  source_url: string | null;
  source?: string;
  published?: string | null;
  retrieved: string;
  status: PipelineStatus;
  sequence: SequenceDates;
  replied: boolean;
  notes: string | null;
};

export type ContactPatch = Partial<
  Pick<ContactRecord, "linkedin_url" | "email" | "email_status" | "status" | "sequence" | "replied" | "notes">
>;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(`PATCH ${url} → ${res.status} ${detail ? JSON.stringify(detail) : ""}`);
  }
  return res.json() as Promise<T>;
}

/** Generic "list of records with an id, backed by a REST resource"
    hook — shared by accounts and contacts below. Patches are optimistic:
    the UI updates immediately and rolls back if the server rejects it. */
function useCrmResource<Rec extends { id: string }, Patch>(resource: "accounts" | "contacts") {
  const url = `/api/crm/${resource}`;
  const [records, setRecords] = useState<Rec[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Rec[] | null>(null);

  const load = useCallback(async () => {
    try {
      const file = await getJson<{ records: Rec[] }>(url);
      latest.current = file.records;
      setRecords(file.records);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (id: string, p: Patch) => {
      const before = latest.current;
      if (before) {
        const next = before.map((r) => (r.id === id ? { ...r, ...p } : r));
        latest.current = next;
        setRecords(next);
      }
      try {
        const updated = await patchJson<Rec>(`${url}/${id}`, p);
        const next = (latest.current ?? []).map((r) => (r.id === id ? updated : r));
        latest.current = next;
        setRecords(next);
        setError(null);
      } catch (e) {
        // Roll back to the last known-good server state.
        latest.current = before;
        setRecords(before);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [url],
  );

  return { records, ready: records !== null, error, patch, reload: load };
}

export function useCrmAccounts() {
  return useCrmResource<AccountRecord, AccountPatch>("accounts");
}

export function useCrmContacts() {
  return useCrmResource<ContactRecord, ContactPatch>("contacts");
}
