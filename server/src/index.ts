import express, { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { AccountPatch, ContactPatch } from "./schemas.js";
import { JsonFileCrmRepository, type CrmRepository } from "./repository.js";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = "127.0.0.1";

// Swap this one line for a Mongo-backed CrmRepository later — nothing
// below this point knows or cares where the data actually lives.
const repo: CrmRepository = new JsonFileCrmRepository();

const app = express();
app.use(express.json());

// Wraps an async handler so a rejected promise reaches Express's error
// handler instead of crashing the process.
function h(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

app.get("/health", (_req, res) => res.json({ ok: true }));

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
