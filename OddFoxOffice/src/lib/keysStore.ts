import { useCallback, useEffect, useState } from "react";
import { getIdToken } from "./googleAuth";

/** Typed client over /api/crm/keys, owned by ../../../server
    (server/src/apiKeys.ts). These are the keys an MCP client carries instead
    of a Google sign-in — see the Settings panel.

    No polling, unlike the other stores: nothing creates a key except this
    page, so there is never anything new to find. */

const BASE = "/api/crm/keys";

function authHeaders(): HeadersInit {
  const token = getIdToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...authHeaders(), ...init?.headers },
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  // BASE, not `path` — the list is `call("")`, and "GET  → 502" says nothing.
  if (!res.ok) throw new Error(body?.error ?? `${init?.method ?? "GET"} ${BASE}${path} → ${res.status}`);
  return body as T;
}

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  created_by: string;
  last_used_at: string | null;
};

/** Only ever returned once, by the call that created it. There is no route
    that can show it again, because the server keeps only its hash. */
export type MintedKey = ApiKey & { key: string };

export function useApiKeys() {
  const [data, setData] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* Bumped to re-fetch. The list only changes because this page changed it,
     so a counter is the whole subscription — no polling, no focus handler,
     unlike the stores that watch a pipeline moving underneath them. */
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    call<{ records: ApiKey[] }>("")
      .then((r) => { if (live) { setData(r.records); setError(null); } })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      });
    return () => { live = false; };
  }, [nonce]);

  return { data, error, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

export const createApiKey = (name: string) =>
  call<MintedKey>("", { method: "POST", body: JSON.stringify({ name }) });

export const revokeApiKey = (id: string) =>
  call<{ id: string; revoked: boolean }>(`/${id}`, { method: "DELETE" });
