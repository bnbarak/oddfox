import { useCallback, useEffect, useState } from "react";
import { getIdToken } from "./googleAuth";

/** Typed client over /api/crm/outreach/*, owned by ../../../server
    (server/src/outreach). Same shape as crmStore: every request carries the
    signed-in user's Google ID token and the server is the one place that
    checks it. */

const BASE = "/api/crm/outreach";

function authHeaders(): HeadersInit {
  const token = getIdToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null;
    throw new Error(body?.detail ?? body?.error ?? `GET ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => null)) as
    | (T & { error?: string; detail?: string })
    | null;
  if (!res.ok) throw new Error(parsed?.detail ?? parsed?.error ?? `POST ${path} → ${res.status}`);
  return parsed as T;
}

// ---- Types ----------------------------------------------------------------

export type Blocker = { code: string; detail: string };
export type DomainRoom = { domain: string; day: string; used: number; cap: number; left: number };
export type TickRow = {
  at: string; due: number; sent: number; replies: number; events: number; ms: number;
  note: string | null; error: string | null;
};

export type Sender = { domain: string; address: string | null; manual_only: boolean };
export type Signature = { id: string; name: string; body: string };
export type OutreachConfig = {
  signatures: Signature[]; default_signature: string | null;
  tracked_addresses: string[];
  sender_name: string; postal_address: string | null; unsubscribe_mailbox: string | null;
  dry_run: boolean; auto_followups: boolean; timezone: string;
  send_window: { start_hour: number; end_hour: number };
  domains: { domain: string; from_local: string; from_name: string; daily_cap: number;
             enabled: boolean; manual_only: boolean; listen_inbound: boolean; note: string | null }[];
};

export const useOutreachConfig = () => useResource<OutreachConfig>("/config");

export async function putOutreachConfig(patch: Partial<OutreachConfig>): Promise<OutreachConfig> {
  const res = await fetch(`${BASE}/config`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  const body = (await res.json().catch(() => null)) as (OutreachConfig & { error?: string }) | null;
  if (!res.ok) throw new Error(body?.error ?? `PUT /config → ${res.status}`);
  return body as OutreachConfig;
}

export type Status = {
  configured: { resend: boolean; model: boolean };
  senders: Sender[];
  blockers: Blocker[];
  dry_run: boolean;
  auto_followups: boolean;
  timezone: string;
  send_window: { start_hour: number; end_hour: number };
  domains: DomainRoom[];
  last_tick: TickRow | null;
};

export type Cell = { sent: number; planned: number; replies: number; bounces: number };
export type HeatRow = {
  account_id: string; company: string; tier: number; url: string | null;
  linkedin_url: string | null; status: string; contacts: number;
  cells: Cell[]; total: Cell; last_sent: string | null;
};
export type Heatmap = {
  weeks: string[]; rows: HeatRow[];
  totals: Cell & { accounts_touched: number; accounts: number };
};

export type QueueRow = {
  id: string; resend_id: string | null; company: string | null; to_email: string;
  subject: string; round: number; from_domain: string; scheduled_at: string | null;
  quota_day: string | null; dry_run: boolean; status: string;
};

export type ReplyRow = {
  id: string; from_email: string; subject: string | null; received_at: string;
  send_id: string | null; account_id: string | null; contact_id: string | null;
  excerpt: string | null; unsubscribe: boolean; automated: boolean;
};

// ---- Hooks ----------------------------------------------------------------

/** One fetch, one error string, one manual reload. The panel renders a real
    explanation when this fails rather than an empty table, because "the
    outreach API is not configured yet" is the expected state until the keys
    arrive, not a bug. */
/** How often an open page re-checks. Not faster on purpose: the server only
    learns about new mail when the heartbeat polls Resend, once a minute, so
    anything quicker just adds requests without seeing anything sooner. */
const POLL_MS = 20_000;

function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await get<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [path]);

  useEffect(() => { void load(); }, [load]);

  /* Keep an open page current, and refresh the moment you come back to it.
     Mail arriving while you are looking elsewhere is the normal case, not the
     exception, and a stale inbox is worse than a slow one because it looks
     authoritative.

     Polling rather than a stream: an SSE connection would hold a Cloud Run
     instance open per viewer, and the server has nothing new to say between
     heartbeats anyway. The timer stops while the tab is hidden — the focus
     handler covers coming back. */
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    let timer = window.setInterval(refresh, POLL_MS);
    const onVisibility = () => {
      window.clearInterval(timer);
      if (document.visibilityState === "visible") {
        void load();
        timer = window.setInterval(refresh, POLL_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  return { data, error, busy, reload: load };
}

export const useOutreachStatus = () => useResource<Status>("/status");
export const useHeatmap = (weeks: number) => useResource<Heatmap>(`/heatmap?weeks=${weeks}`);
export type CampaignRow = {
  id: string; name: string; persona: string; template_tier: number;
  account_ids: string[]; active: boolean; companies: string[];
  people: number; with_email: number; to_enrich: number; unreachable: number; sent: number;
};

export const useCampaigns = () =>
  useResource<{ records: CampaignRow[]; credits_today: number }>("/campaigns");

export const useQueue = () => useResource<{ records: QueueRow[] }>("/queue");
export const useReplies = () => useResource<{ records: ReplyRow[] }>("/replies?limit=100");

// ---- Actions --------------------------------------------------------------

export const cancelSend = (id: string) =>
  post<{ id: string; canceled: boolean; note: string }>(`/sends/${id}/cancel`);

export const runTick = () =>
  post<{ at: string; due: number; scheduled: number; replies: number; events: number;
         ms: number; blocked: string[]; notes: string[] }>("/tick");

export type ThreadMessage = {
  dir: "out" | "in"; id: string; subject: string | null; body: string | null; at: string;
  status?: string; round?: number; dry_run?: boolean; cancel_token?: string | null;
  message_id?: string | null; automated?: boolean; unsubscribe?: boolean;
};
export type Thread = {
  key: string; contact_id: string | null; full_name: string; title: string; company: string | null;
  account_id: string | null; email: string | null; last_at: string;
  sent: number; replies: number; replied: boolean; messages: ThreadMessage[];
};

export const useThreads = () => useResource<{ threads: Thread[] }>("/threads");

/** A one-off, written by hand. round 0 keeps it out of the sequence, so it
    never triggers a follow-up — but it still goes through the same schedule
    path, so the daily cap, the footer and dry-run all still apply. */
/** `who` is a CRM contact id, or a plain address for somebody outside it. */
export const sendDirect = (
  who: { contact_id: string | null; to: string | null },
  subject: string, body: string,
  domain: string | null = null, signature: string | null = null,
  thread: { in_reply_to: string | null; references: string[] } =
    { in_reply_to: null, references: [] },
) =>
  post<{ id: string; cancel_token: string | null; scheduled_at: string; dry_run: boolean }>(
    "/schedule",
    { ...who, round: 0, subject, body, scheduled_at: null, domain,
      written_by: "template", template_tier: null, signature, ...thread });

export type ChatTurn = { role: "user" | "assistant"; content: string; at: string };

/** The conversation lives on the server, as one thread shared by everyone on
    the allow-list — so a reload keeps it, and two people working the pipeline
    see the same one rather than each telling the agent things the other
    already asked for. */
export const useThread = () =>
  useResource<{ turns: ChatTurn[]; model_configured: boolean }>("/chat");

export const sendChat = (message: string) =>
  post<{ text: string; thread: ChatTurn[] }>("/chat", { message });

export async function clearThread(): Promise<void> {
  const res = await fetch(`${BASE}/chat`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(`DELETE /chat → ${res.status}`);
}

export const draftMessage = (contact_id: string, round: 1 | 2 | 3, guidance: string | null) =>
  post<{ subject: string; body: string; why: string; template_tier: number;
         unresolved: string[]; written_by: string; fell_back: string | null }>(
    "/draft", { contact_id, round, use_agent: true, guidance });
