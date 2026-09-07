import express, { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { AccountPatch, ContactPatch } from "./schemas.js";
import { JsonFileCrmRepository, type CrmRepository } from "./repository.js";
import { FirestoreCrmRepository } from "./firestoreRepository.js";
import { requireGoogleUser } from "./auth.js";
import { outreachRouter } from "./outreach/routes.js";
import { requireScheduler } from "./outreach/tickAuth.js";
import { tick } from "./outreach/tick.js";

const PORT = Number(process.env.PORT ?? 8787);
// Cloud Run only routes traffic to 0.0.0.0; local dev stays loopback-only.
const HOST = process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1";

// Firestore is the source of truth everywhere, including local dev (ADC
// already authenticates against the same project). CRM_REPO=json is an
// escape hatch for offline work against the data/json/crm/*.json seed.
const repo: CrmRepository =
  process.env.CRM_REPO === "json" ? new JsonFileCrmRepository() : new FirestoreCrmRepository();

const app = express();
app.use(express.json());

// Wraps an async handler so a rejected promise reaches Express's error
// handler instead of crashing the process.
function h(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

app.get("/health", (_req, res) => res.json({ ok: true }));

// The outreach heartbeat, called once a minute by Cloud Scheduler. It sits
// outside /api on purpose: Cloud Scheduler has no Google ID token for our
// OAuth client. It signs each call with an OIDC token for its own service
// account instead — no shared secret anywhere. Everything it does is
// idempotent, so a retry or an overlapping beat is harmless.
app.post("/tasks/tick", requireScheduler, h(async (_req, res) => {
  res.json(await tick());
}));

// Every API route, present or future, requires a signed-in, allow-listed
// Google account. Mounted broad on purpose — a new route added under /api
// later is covered automatically, no separate opt-in required.
app.use("/api", requireGoogleUser);

// ---- Accounts -------------------------------------------------------------

app.get(
  "/api/crm/accounts",
  h(async (_req, res) => {
    res.json(await repo.getAccounts());
  }),
);

app.patch(
  "/api/crm/accounts/:id",
  h(async (req, res) => {
    const patch = AccountPatch.parse(req.body);
    const updated = await repo.patchAccount(req.params.id as string, patch);
    if (!updated) {
      res.status(404).json({ error: `no account with id ${req.params.id}` });
      return;
    }
    res.json(updated);
  }),
);

// ---- Contacts ---------------------------------------------------------

app.get(
  "/api/crm/contacts",
  h(async (_req, res) => {
    res.json(await repo.getContacts());
  }),
);

app.patch(
  "/api/crm/contacts/:id",
  h(async (req, res) => {
    const patch = ContactPatch.parse(req.body);
    const updated = await repo.patchContact(req.params.id as string, patch);
    if (!updated) {
      res.status(404).json({ error: `no contact with id ${req.params.id}` });
      return;
    }
    res.json(updated);
  }),
);

// ---- Outreach (Mastra agent, Resend sending, heat map) --------------------

app.use("/api/crm/outreach", outreachRouter);

// ---- Sequences (read-only content library) --------------------------------

app.get(
  "/api/crm/sequences",
  h(async (_req, res) => {
    res.json(await repo.getSequences());
  }),
);

// ---- Errors -----------------------------------------------------------

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "validation failed", issues: err.issues });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "malformed JSON body" });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`oddfox-crm-server listening on http://${HOST}:${PORT}`);
});
