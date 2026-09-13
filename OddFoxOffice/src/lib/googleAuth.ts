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
  scheduleRenewal();
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
          initialize(config: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
            /** Re-issues to a returning user without asking again, which is
                what makes the hourly renewal below silent. */
            auto_select?: boolean;
            use_fedcm_for_prompt?: boolean;
          }): void;
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
          prompt(): void;
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

/* ---- Keeping the token alive -------------------------------------------

   A Google ID token lasts an hour. Nothing renewed it, so a morning's work
   was interrupted by a sign-in screen roughly every hour — and worse than
   the screen, whatever request was in flight when it lapsed failed first.

   Renewal is the same call as sign-in: Google re-issues to a returning user
   who is still signed in to Google and has approved this app, without asking
   anything. It happens five minutes before the token expires, so there is no
   moment where a request goes out with a dead token. If it cannot be silent
   — signed out of Google, consent withdrawn — Google shows its own prompt,
   which is the honest outcome and the one the sign-in button already
   handles. */

const RENEW_BEFORE_MS = 5 * 60 * 1000;
/** setTimeout's ceiling. A longer wait than this fires immediately, which
    would be a renewal loop rather than a renewal. */
const MAX_TIMEOUT = 2 ** 31 - 1;

let gis: Promise<void> | null = null;
function ensureGis(): Promise<void> {
  gis ??= loadGoogleIdentityServices().then(() => {
    window.google!.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (resp) => setToken(resp.credential),
      /* Both of these are what make a renewal silent: auto_select re-issues
         to somebody who has approved before, and FedCM is how Chrome does
         that now — without it the prompt is suppressed outright in newer
         versions. */
      auto_select: true,
      use_fedcm_for_prompt: true,
    });
  });
  return gis;
}

let renewing: Promise<string | null> | null = null;

/** Asks Google for a new token now. Concurrent callers share one attempt. */
export function renewIdToken(): Promise<string | null> {
  renewing ??= (async () => {
    try {
      await ensureGis();
      return await new Promise<string | null>((resolve) => {
        const finish = (t: string | null) => {
          listeners.delete(watch);
          clearTimeout(giveUp);
          resolve(t);
        };
        const watch = () => { if (isFresh(currentToken)) finish(currentToken); };
        listeners.add(watch);
        /* Eight seconds, then give up and let the caller carry on. A prompt
           the person is looking at but has not answered must not hold a
           request open for as long as they take to decide. */
        const giveUp = setTimeout(() => finish(null), 8000);
        window.google!.accounts.id.prompt();
      });
    } catch {
      return null;
    } finally {
      renewing = null;
    }
  })();
  return renewing;
}

let renewTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRenewal() {
  clearTimeout(renewTimer);
  const exp = currentToken ? decodeClaims(currentToken)?.exp : null;
  if (typeof exp !== "number") return;
  const wait = exp * 1000 - Date.now() - RENEW_BEFORE_MS;
  renewTimer = setTimeout(() => void renewIdToken(), Math.min(Math.max(wait, 1_000), MAX_TIMEOUT));
}

/** A token good for the next request, renewed first if it is not.

    Every fetch helper awaits this instead of reading getIdToken directly, so
    a tab left open overnight sends a live token rather than discovering the
    dead one from the server's 401. */
export async function freshToken(): Promise<string | null> {
  return getIdToken() ?? (await renewIdToken());
}

/** Whether this tab has ever held a token. An expired one is left in
    storage on purpose: it is the only evidence that this person was signed
    in, and renewing for somebody who never signed in would put a prompt in
    front of a stranger. */
function everSignedIn(): boolean {
  try {
    return Boolean(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  if (currentToken) scheduleRenewal();
  else if (everSignedIn()) void renewIdToken(); // came back to a stale tab
  /* A background tab's timers are throttled and a sleeping laptop's do not
     run at all, so the timer alone is not enough: coming back to the tab is
     exactly when the token has quietly expired. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !getIdToken() && everSignedIn()) {
      void renewIdToken();
    }
  });
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
    // One initialize for the whole app: the renewal above needs Google
    // configured whether or not this hook is mounted.
    ensureGis()
      .then(() => {
        if (!cancelled) setReady(true);
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
