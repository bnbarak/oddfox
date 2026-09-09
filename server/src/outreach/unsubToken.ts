import { createHmac, timingSafeEqual } from "node:crypto";
import { secret } from "./config.js";

/* The unsubscribe link, and the only thing that makes it safe to expose.

   The endpoint it points at is public and unauthenticated — it has to be, a
   recipient has no account here — so the URL itself has to carry proof that
   we issued it. A signed token does that: the address travels in the link,
   and the signature means nobody can opt somebody else out by editing it.

   No database lookup, no random id to store. A token is derived from the
   address, so the same person always gets the same link and a link printed in
   a message sent last month still works after any amount of redeployment. */

/** Where the click lands. A subdomain rather than a path on the app: the app
    is behind a Google sign-in check and this cannot be, and keeping the two
    on separate hosts makes that impossible to get wrong by accident. */
export const UNSUB_BASE = (): string =>
  (process.env.UNSUBSCRIBE_BASE_URL?.trim() || "https://unsubscribe.seaworth.ai").replace(/\/+$/, "");

/** Signing key. Absent means no links are produced at all — see linkFor().
    It must be stable across deploys or every link already in somebody's
    inbox stops verifying, which is why it is a stored secret and not
    generated at boot. */
const key = (): string | null => secret("UNSUBSCRIBE_SECRET");

/** True when this deployment can mint links. False falls the footer back to
    the reply-to-unsubscribe wording, which is still a lawful opt-out. */
export const canLink = (): boolean => key() !== null;

const b64url = (b: Buffer): string => b.toString("base64url");

const sign = (payload: string, k: string): string =>
  b64url(createHmac("sha256", k).update(payload).digest()).slice(0, 27);

/** `<base64url(email)>.<signature>`. The address is readable in the link on
    purpose: the page that opens has to be able to say *which* address it just
    stopped writing to, and a recipient checking what they are about to click
    should be able to see it. It is their own address; there is nothing to
    hide from them, and the signature is what stops anyone else forging one. */
export function tokenFor(email: string): string | null {
  const k = key();
  if (!k) return null;
  const addr = email.trim().toLowerCase();
  const payload = b64url(Buffer.from(addr, "utf8"));
  return `${payload}.${sign(payload, k)}`;
}

/** The address a token was issued for, or null if it was not issued by us. */
export function addressIn(token: string): string | null {
  const k = key();
  if (!k) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload, k));
  const got = Buffer.from(sig);
  // Constant time, and only after the lengths match — timingSafeEqual throws
  // on a length mismatch rather than returning false.
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const addr = Buffer.from(payload, "base64url").toString("utf8").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) ? addr : null;
}

/** The full URL to put in a message to `email`, or null when unconfigured. */
export function linkFor(email: string): string | null {
  const t = tokenFor(email);
  return t ? `${UNSUB_BASE()}/u/${t}` : null;
}
