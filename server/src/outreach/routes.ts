import { Router, type NextFunction, type Request, type Response } from "express";
import { Resend } from "resend";
import { draft, modelConfigured } from "./agent.js";
import { blockers, fromAddress, secret } from "./config.js";
import { heatmap } from "./heatmap.js";
import { cancel, nextSlot, Refused, schedule, sendNow } from "./send.js";
import {
  allCampaigns, allOptOuts, allReplies, allSends, clearThread, getConfig, getThread, headroom,
  lastTick, putCampaign, putConfig, recentTicks,
} from "./store.js";
import { optOut } from "./optout.js";
import { canLink, UNSUB_BASE } from "./unsubToken.js";
import { allEnrichment, spentToday } from "./apollo.js";
import { startCampaign } from "./start.js";
import { statesFor } from "./campaignState.js";
import * as crm from "./crm.js";
import { chat } from "./operator.js";
import { threads } from "./threads.js";
import { due, tick } from "./tick.js";
import { z } from "zod";
import { configPatch, DraftRequest, ScheduleRequest } from "./schemas.js";

/* HTTP surface, as its own Router so index.ts needs one import and one mount.
   Everything here is under /api, so it is already behind the Google sign-in
   check in ../auth.ts. The heartbeat is the exception and is mounted
   separately with its own shared secret. */

export const outreachRouter: Router = Router();

const h = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

// ---- Status and configuration ---------------------------------------------

/** One call that tells the panel everything it needs: what is stopping a
    send, how much room each domain has left, and whether the heartbeat is
    actually beating. */
outreachRouter.get("/status", h(async (_req, res) => {
  const cfg = await getConfig();
  const [domains, beat] = await Promise.all([headroom(cfg), lastTick()]);
  res.json({
    configured: {
      resend: Boolean(secret("RESEND_API_KEY")),
      model: modelConfigured(),
      /** Whether commercial mail can carry a one-click unsubscribe link, or
          has to fall back to asking people to reply. Not a blocker — the
          reply wording is lawful on its own — but it is worth seeing. */
      unsubscribe_link: canLink(),
      unsubscribe_host: canLink() ? UNSUB_BASE() : null,
    },
    blockers: blockers(cfg),
    dry_run: cfg.dry_run,
    auto_followups: cfg.auto_followups,
    timezone: cfg.timezone,
    send_window: cfg.send_window,
    domains,
    /** Which addresses a person may send from by hand, and which of those
        the automation is forbidden to use. */
    senders: cfg.domains.filter((d) => d.enabled).map((d) => ({
      domain: d.domain,
      address: fromAddress(cfg, d.domain),
      manual_only: d.manual_only,
    })).filter((x) => x.address),
    last_tick: beat,
  });
}));

outreachRouter.get("/config", h(async (_req, res) => { res.json(await getConfig()); }));

outreachRouter.put("/config", h(async (req, res) => {
  // configPatch, not OutreachConfig.partial() — see the note on it. A partial
  // parse fills in every absent field's default, and writing those back is
  // indistinguishable from being asked to clear them.
  res.json(await putConfig(configPatch(req.body)));
}));

// ---- Writing and scheduling -----------------------------------------------

/** Writes a message. Never sends one — the reply is a draft for a person to
    read, edit, and pass to /schedule. */
outreachRouter.post("/draft", h(async (req, res) => {
  const body = DraftRequest.parse(req.body);
  const cfg = await getConfig();
  const useModel = body.use_agent && modelConfigured();
  const prior = (await allSends())
    .filter((s) => s.contact_id === body.contact_id && s.status !== "canceled");
  const out = await draft(body.contact_id, body.round, cfg,
                          { useModel, guidance: body.guidance, prior });
  res.json({
    ...out,
    written_by: useModel ? "agent" : "template",
    fell_back: body.use_agent && !useModel
      ? "GOOGLE_API_KEY is not set, so the template was filled instead" : null,
  });
}));

outreachRouter.post("/schedule", h(async (req, res) => {
  const body = ScheduleRequest.parse(req.body);
  const cfg = await getConfig();
  res.json(await schedule(body, cfg, await allSends()));
}));

outreachRouter.post("/sends/:id/cancel", h(async (req, res) => {
  res.json(await cancel(req.params.id as string));
}));

/** Brings a scheduled message forward to now.

    Cancels it at Resend and re-schedules it a minute out, which is the same
    shape as everything else here: still scheduled, so still cancellable, just
    without the wait. Deliberately not a direct send — losing the undo window
    to save sixty seconds is a bad trade on cold mail. */
outreachRouter.post("/sends/:id/send-now", h(async (req, res) => {
  res.json(await sendNow(req.params.id as string, await getConfig()));
}));

outreachRouter.get("/sends", h(async (_req, res) => {
  res.json({ records: await allSends() });
}));

/** What is still cancellable, soonest first — the list the panel puts cancel
    buttons next to. */
outreachRouter.get("/queue", h(async (_req, res) => {
  const records = (await allSends())
    .filter((s) => s.status === "scheduled" || s.status === "draft")
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  res.json({ records });
}));

outreachRouter.get("/next-slot", h(async (req, res) => {
  const cfg = await getConfig();
  const domain = (req.query.domain as string) || cfg.domains.find((d) => d.enabled)?.domain;
  if (!domain) { res.status(409).json({ error: "no enabled sending domain" }); return; }
  res.json({ domain, scheduled_at: nextSlot(cfg, domain, await allSends()).toISOString() });
}));

// ---- Incoming -------------------------------------------------------------

outreachRouter.get("/replies", h(async (_req, res) => {
  res.json({ records: await allReplies() });
}));

/** Proxied straight from Resend, which owns the list: it adds to it on every
    bounce and complaint and skips sending to anything on it. */
outreachRouter.get("/suppressions", h(async (_req, res) => {
  const key = secret("RESEND_API_KEY");
  if (!key) { res.json({ records: [], note: "no RESEND_API_KEY" }); return; }
  const { data, error } = await new Resend(key).suppressions.list();
  if (error) { res.status(502).json({ error: error.message }); return; }
  res.json({ records: data?.data ?? [] });
}));

/** Adding somebody by hand — a phone call, a LinkedIn message, a forwarded
    complaint. Goes through the same path as a click on the link rather than
    writing the Resend list directly, so a hand-added opt-out also cancels
    what is queued and marks the contact. There was one way to opt out that
    did everything and one that did a quarter of it, which is one too many. */
outreachRouter.post("/suppressions", h(async (req, res) => {
  const email = (req.body as { email?: string }).email;
  if (!email) { res.status(400).json({ error: "email is required" }); return; }
  res.json({ ...(await optOut(email, "manual", "added from the panel")), suppressed: true });
}));

/** Our own record of who asked to be left alone, and how they told us.

    Separate from /suppressions, which is Resend's list: that one is the
    enforcement and includes every bounce and spam complaint; this one is the
    evidence, and only contains people who actually asked. */
outreachRouter.get("/optouts", h(async (_req, res) => {
  res.json({ records: await allOptOuts() });
}));

// ---- The operator agent ---------------------------------------------------

const ChatRequest = z.object({ message: z.string().min(1).max(8000) }).strict();

/** The shared thread, so a reload does not lose the conversation and both
    people on the allow-list see the same one. */
outreachRouter.get("/chat", h(async (_req, res) => {
  res.json({ turns: await getThread(), model_configured: modelConfigured() });
}));

outreachRouter.delete("/chat", h(async (_req, res) => {
  await clearThread();
  res.json({ turns: [] });
}));

/** Talk to the agent instead of clicking. */
outreachRouter.post("/chat", h(async (req, res) => {
  if (!modelConfigured()) {
    res.status(409).json({
      error: "no-model",
      detail: "GOOGLE_API_KEY is not set, so the operator agent cannot run. " +
              "Everything else on this page still works.",
    });
    return;
  }
  const { message } = ChatRequest.parse(req.body);
  res.json(await chat(message));
}));

/** One conversation per person: everything sent, everything that came back,
    in order. What the Inbox renders. */
outreachRouter.get("/threads", h(async (_req, res) => {
  res.json({ threads: await threads() });
}));

/** Statuses that mean a message actually reached a mailbox. */
const LANDED = new Set(["sent", "delivered", "opened", "clicked", "bounced", "complained"]);

/** Campaigns, with the one number that decides whether one can start: how
    many of its people we can actually reach. Addresses we do not have are
    bought at send time for a campaign account, so "missing" is a forecast of
    spend rather than a blocker — and "no address, already looked up" is
    neither, because that lookup will not happen twice. */
outreachRouter.get("/campaigns", h(async (_req, res) => {
  const [records, accounts, contacts, sends, replies, ledger] = await Promise.all([
    allCampaigns(), crm.accounts(), crm.contacts(), allSends(), allReplies(), allEnrichment(),
  ]);
  const looked = new Map(ledger.map((e) => [e.contact_id, e]));

  res.json({
    credits_today: await spentToday(),
    /** Every account's campaign state, so the account page and the outreach
        table read it from one place rather than each deriving it. */
    states: statesFor(accounts.map((a) => a.id), records, sends),
    records: records.map((c) => {
      const people = contacts.filter((p) => p.account_id && c.account_ids.includes(p.account_id));
      const mine = sends.filter((s) => s.account_id && c.account_ids.includes(s.account_id)
                                       && s.status !== "canceled");
      const exhausted = people.filter((p) => !p.email && looked.get(p.id)?.matched === false);
      return {
        ...c,
        companies: c.account_ids.map((id) => accounts.find((a) => a.id === id)?.company ?? id),
        people: people.length,
        with_email: people.filter((p) => p.email).length,
        // People we would pay to look up if this campaign ran now.
        to_enrich: people.filter((p) => !p.email && !looked.has(p.id)).length,
        // Looked up already and Apollo had nothing. Not reachable, not billable.
        unreachable: exhausted.length,
        sent: mine.filter((s) => LANDED.has(s.status)).length,
        // Still cancellable — the number that says "this is in flight".
        queued: mine.filter((s) => s.status === "scheduled" || s.status === "draft").length,
        replies: replies.filter((r) => !r.automated && r.account_id
                                       && c.account_ids.includes(r.account_id)).length,
        last_at: mine.map((s) => s.scheduled_at ?? s.created_at).sort().at(-1) ?? null,
      };
    }),
  });
}));

/** Switching a campaign on buys the addresses and queues round 1 to everyone.

    Deliberately eager on both counts: the owner chose paying at activation
    over a first send that pauses to shop, and chose queueing everybody at
    once over drip-feeding approvals. What makes that safe is that nothing is
    sent — every message is scheduled, paced, capped, and cancellable from the
    queue until it goes. The response says what it cost and what it queued. */
outreachRouter.post("/campaigns/:id/activate", h(async (req, res) => {
  const c = (await allCampaigns()).find((x) => x.id === req.params.id);
  if (!c) { res.status(404).json({ error: `no campaign with id ${req.params.id}` }); return; }
  await putCampaign({ ...c, active: true });
  res.json({ id: c.id, active: true, ...(await startCampaign(c, await getConfig())) });
}));

outreachRouter.post("/campaigns/:id/pause", h(async (req, res) => {
  const c = (await allCampaigns()).find((x) => x.id === req.params.id);
  if (!c) { res.status(404).json({ error: `no campaign with id ${req.params.id}` }); return; }
  await putCampaign({ ...c, active: false });
  res.json({ id: c.id, active: false });
}));

/** Who we have looked up and what came back, keyed by contact.

    The panels need the difference between "we have never asked about this
    person" and "we asked and Apollo has nothing", because the first is a
    gap somebody can fill and the second is closed. Both look like a missing
    address without this. */
outreachRouter.get("/enrichment", h(async (_req, res) => {
  const records = await allEnrichment();
  res.json({
    credits_today: await spentToday(),
    records: records.map(({ contact_id, matched, email, at, note }) =>
      ({ contact_id, matched, email, at, note })),
  });
}));

// ---- Reporting ------------------------------------------------------------

outreachRouter.get("/heatmap", h(async (req, res) => {
  const weeks = Math.min(52, Math.max(4, Number(req.query.weeks ?? 12)));
  const [sends, replies] = await Promise.all([allSends(), allReplies()]);
  res.json(await heatmap(sends, replies, weeks));
}));

outreachRouter.get("/due", h(async (_req, res) => {
  const cfg = await getConfig();
  res.json({ records: due(cfg, await allSends(), await allReplies()) });
}));

outreachRouter.get("/ticks", h(async (_req, res) => {
  res.json({ records: await recentTicks() });
}));

/** Runs a heartbeat by hand — the same code path as the scheduled one, so a
    manual run is a real test of it rather than a different thing that also
    works. */
outreachRouter.post("/tick", h(async (_req, res) => { res.json(await tick()); }));

// ---- Errors ---------------------------------------------------------------

outreachRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Refused) {
    res.status(err.status).json({ error: err.code, detail: err.message });
    return;
  }
  next(err);
});
