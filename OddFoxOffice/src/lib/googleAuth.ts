import { useCallback, useEffect, useRef, useState } from "react";

/** Web client from the "Maine" GCP project (209354378060), authorized for
    https://seaworth.ai and http://localhost:5790. This ID is public by
    design for browser OAuth clients — the server independently verifies
    every token's signature and audience with Google, so nothing here is
    a secret. */
const CLIENT_ID = "209354378060-solba4bugfutcog1sao3856tg86l09qa.apps.googleusercontent.com";
const STORAGE_KEY = "oddfox.google_id_token";

type IdTokenClaims = { email?: string; exp?: number; name?: string; picture?: string };

function decodeClaims(token: string): IdTokenClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as IdTokenClaims;
  } catch {
    return null;
  }
}

function isFresh(token: string | null): token is string {
  if (!token) return false;
  const claims = decodeClaims(token);
  return typeof claims?.exp === "number" && claims.exp * 1000 > Date.now() + 30_000;
}

function readStoredToken(): string | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return isFresh(stored) ? stored : null;
  } catch {
    return null;
  }
}

let currentToken: string | null = readStoredToken();
const listeners = new Set<() => void>();

function setToken(token: string | null) {
  currentToken = token;
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode — token still works for this tab's lifetime */
  }
  listeners.forEach((l) => l());
}

/** Read by crmStore.ts on every request. Kept as a plain function (not a
    hook) so the fetch helpers don't need to be React components. */
export function getIdToken(): string | null {
  return isFresh(currentToken) ? currentToken : null;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (resp: { credential: string }) => void }): void;
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
          disableAutoSelect(): void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Sign-in state for the CRM. `buttonRef` must be attached to an empty div
    — Google renders its own button into it once loaded. */
export function useGoogleAuth() {
  const [token, setLocalToken] = useState<string | null>(getIdToken());
  const [ready, setReady] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const listener = () => setLocalToken(getIdToken());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadGoogleIdentityServices()
      .then(() => {
        if (cancelled) return;
        window.google!.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp) => setToken(resp.credential),
        });
        setReady(true);
      })
      .catch(() => {
        /* offline, or the script host is blocked — sign-in button just won't appear */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || token || !buttonRef.current) return;
    window.google?.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "medium" });
  }, [ready, token]);

  const signOut = useCallback(() => {
    window.google?.accounts.id.disableAutoSelect();
    setToken(null);
  }, []);

  const claims = token ? decodeClaims(token) : null;
  return {
    token, email: claims?.email ?? null, name: claims?.name ?? null,
    // Google puts a real avatar in the id token; use it rather than drawing
    // initials for somebody who has a picture.
    picture: claims?.picture ?? null,
    ready, buttonRef, signOut,
  };
}
