import type { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";

/* Authentication for the heartbeat endpoint.

   It cannot use the Google sign-in check in ../auth.ts: Cloud Scheduler is not
   a person and holds no ID token for our OAuth client.

   It used to use a shared secret, which was wrong in a way worth writing down.
   The secret itself lived in Secret Manager, but Cloud Scheduler cannot read
   Secret Manager — so the *job* carried the value as a plaintext header, and
   anyone with `cloudscheduler.jobs.get` could read it. A secret that has to be
   copied somewhere to be used is not really stored in Secret Manager.

   So there is no secret now. Cloud Scheduler signs each call with a Google
   OIDC token for its own service account, and this verifies the signature,
   the audience, and that the caller is exactly that account. Nothing to
   store, nothing to rotate, nothing to leak. */

const client = new OAuth2Client();

/** The only identity allowed to run the heartbeat. Set at deploy time; with
    it unset nothing can call the endpoint, which is the right answer for
    something that can send email. */
const CALLER = process.env.SCHEDULER_SERVICE_ACCOUNT ?? "";

/** The token's audience is the URL Cloud Scheduler was told to call, so a
    token minted for some other service cannot be replayed here. */
const AUDIENCE = process.env.TICK_AUDIENCE ?? "";

export function requireScheduler(req: Request, res: Response, next: NextFunction): void {
  if (!CALLER || !AUDIENCE) {
    res.status(503).json({ error: "heartbeat caller is not configured" });
    return;
  }
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  client
    .verifyIdToken({ idToken: token, audience: AUDIENCE })
    .then((ticket) => {
      const payload = ticket.getPayload();
      if (payload?.email !== CALLER || payload.email_verified === false) {
        res.status(403).json({ error: "caller is not the heartbeat service account" });
        return;
      }
      next();
    })
    .catch(() => {
      res.status(401).json({ error: "invalid or expired token" });
    });
}
