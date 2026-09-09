import { createHash, randomBytes } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { db } from "./firebaseApp.js";

/* API keys: the second way into this server, and the only one that is not a
   person at a browser.

   Everything under /api is authenticated by a Google ID token, which works
   because there is somebody to sign in and a page to sign in on. An MCP
   client — Claude Code on a laptop — has neither, so it carries one of these
   instead.

   A key is 32 random bytes. What is stored is its SHA-256, as the document
   id, so checking one is a single point read of a collection that never
   holds a usable secret: reading every document in it gets you nothing. The
   plaintext exists only in the response that created it, which is the one
   and only time it is ever shown.

   A key is not a lesser Google account. It reaches exactly one route — the
   MCP endpoint — and nothing else under /api, which is why the check below
   is mounted on that route by name rather than added to requireGoogleUser as
   an alternative. */

const KEYS = "crmApiKeys";

export type KeyRecord = {
  name: string;
  /** The first few characters of the key, so two of them can be told apart
      in a list without any of them being recoverable from it. */
  prefix: string;
  created_at: string;
  created_by: string;
  last_used_at: string | null;
};

const digest = (key: string): string => createHash("sha256").update(key).digest("hex");

/** `sw_` then 32 random bytes. The prefix is there so a leaked key is
    recognisable as one — secret scanners key off exactly this shape. */
const mint = (): string => `sw_${randomBytes(32).toString("base64url")}`;

/* Last-used is a convenience, not an audit trail, so it is written at most
   once a minute per key and never awaited. An MCP client makes three or four
   calls to open a session; each one writing a document would triple this
   collection's write volume to record the same minute. */
const touched = new Map<string, number>();
const TOUCH_MS = 60_000;

function touch(id: string): void {
  const now = Date.now();
  if (now - (touched.get(id) ?? 0) < TOUCH_MS) return;
  touched.set(id, now);
  db().collection(KEYS).doc(id).update({ last_used_at: new Date().toISOString() })
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("failed to record api key use", err);
    });
}

/** Requires a live API key in `Authorization: Bearer`. Nothing about a
    failure is written down: unlike a Google sign-in, which is a real person
    who got as far as a consent screen, anyone at all can post a wrong key
    here, and logging those would be an unauthenticated write endpoint. */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!key) {
    res.status(401)
      .set("WWW-Authenticate", 'Bearer realm="seaworth-mcp"')
      .json({ error: "missing bearer token" });
    return;
  }
  const id = digest(key);
  db().collection(KEYS).doc(id).get()
    .then((snap) => {
      if (!snap.exists) {
        res.status(401).json({ error: "unknown or revoked api key" });
        return;
      }
      touch(id);
      next();
    })
    .catch(next);
}

// ---- Managing them --------------------------------------------------------

/** Mounted under /api, so every route here is already behind Google sign-in:
    a key can be made only by somebody on the allow-list, and it can do less
    than they can. */
export const keysRouter: Router = Router();

const h = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/** The id in this list is the key's SHA-256 — a digest of 256 random bits,
    so publishing it to the two people who can already read the CRM gives
    away nothing, and it saves keeping a second identifier around. */
keysRouter.get("/", h(async (_req, res) => {
  const snap = await db().collection(KEYS).get();
  const records = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as KeyRecord) }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json({ records });
}));

keysRouter.post("/", h(async (req, res) => {
  const name = String((req.body as { name?: unknown }).name ?? "").trim().slice(0, 60);
  if (!name) {
    res.status(400).json({ error: "a name is required — it is the only way to tell keys apart" });
    return;
  }
  const key = mint();
  const record: KeyRecord = {
    name,
    prefix: key.slice(0, 11),
    created_at: new Date().toISOString(),
    created_by: req.userEmail ?? "unknown",
    last_used_at: null,
  };
  await db().collection(KEYS).doc(digest(key)).set(record);
  // The only time the plaintext is ever returned. There is no route that can
  // show it again, because there is nowhere it is kept.
  res.json({ id: digest(key), key, ...record });
}));

keysRouter.delete("/:id", h(async (req, res) => {
  const id = req.params.id as string;
  const ref = db().collection(KEYS).doc(id);
  if (!(await ref.get()).exists) {
    res.status(404).json({ error: "no such key" });
    return;
  }
  await ref.delete();
  touched.delete(id);
  res.json({ id, revoked: true });
}));
