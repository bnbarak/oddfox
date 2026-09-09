import type { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { db } from "./firebaseApp.js";

/** Web client from the "Maine" GCP project (209354378060), authorized for
    https://seaworth.ai and http://localhost:5790. OAuth client IDs for
    browser apps are public by design — safe to embed here and in the
    frontend bundle. What's actually secret is never issued to the browser:
    the server independently verifies every token's signature with Google. */
const GOOGLE_CLIENT_ID = "209354378060-solba4bugfutcog1sao3856tg86l09qa.apps.googleusercontent.com";

/** The whole allow-list. Deliberately a short, hardcoded array, not just an
    env var default — extend it here on purpose, not by accident. */
const ALLOWED_EMAILS = new Set<string>(["bn.barak@gmail.com", "ofer.rogers@gmail.com"]);

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/** Who the request turned out to be. Set once, by the check below, so a
    route that needs to record an author does not verify the token again. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userEmail?: string;
    }
  }
}

/** Every *valid* Google sign-in is recorded — allowed or not — so there's a
    record of who has tried to reach the CRM. This never blocks the
    request; a write failure here must not take the API down. */
function logAccess(email: string, name: string | undefined, allowed: boolean): void {
  db()
    .collection("crmAccessLog")
    .add({ email, name: name ?? null, allowed, at: new Date().toISOString() })
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("failed to write crmAccessLog", err);
    });
}

/** Requires a valid Google ID token (Sign in with Google, audience = our
    client ID) whose email is in ALLOWED_EMAILS. Mounted on every /api
    route in index.ts — this check, not Cloud Run's own IAM layer, is the
    real access boundary, since Cloud Run has to accept the connection
    before this code ever runs. */
export function requireGoogleUser(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  client
    .verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID })
    .then((ticket) => {
      const payload = ticket.getPayload();
      const email = payload?.email?.toLowerCase();
      if (!email) {
        res.status(401).json({ error: "token has no email" });
        return;
      }
      const allowed = ALLOWED_EMAILS.has(email);
      logAccess(email, payload?.name, allowed);
      if (!allowed) {
        res.status(403).json({ error: "account not allowed" });
        return;
      }
      req.userEmail = email;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: "invalid or expired token" });
    });
}
