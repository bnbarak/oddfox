import { Router, type NextFunction, type Request, type Response } from "express";
import { Resend } from "resend";
import { draft, modelConfigured } from "./agent.js";
import { blockers, fromAddress, SENDERS, secret } from "./config.js";
import { heatmap } from "./heatmap.js";
import { cancel, nextSlot, Refused, schedule, sendNow } from "./send.js";
import {
  allCampaigns, allOptOuts, allReplies, allSends, campaignFor, clearThread, getConfig,
  getSeen, getThread, headroom, lastTick, deleteCampaign, markSeen, putCampaign, putConfig,
  recentTicks,
} from "./store.js";
import { withReads } from "./reads.js";
import { optBackIn, optOut } from "./optout.js";
import { canLink, UNSUB_BASE } from "./unsubToken.js";
import { allEnrichment, spentToday } from "./apollo.js";
import { endCampaign, startCampaign } from "./start.js";
import { statesFor } from "./campaignState.js";
import * as crm from "./crm.js";
import { chat } from "./operator.js";
import { threads } from "./threads.js";
import { due, tick } from "./tick.js";
import { z } from "zod";
import { Campaign, configPatch, DraftRequest, ScheduleRequest } from "./schemas.js";

/** What the panel may send. Narrower than Campaign on purpose: `active`,
    `created_at` and `deleted_at` are the server's to decide. */
const NewCampaign = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/,
    "an id is lower-case letters, digits and hyphens"),
  name: z.string().min(1),
  persona: z.string().min(1),
  template_tier: z.number().int().min(1),
  account_ids: z.array(z.string()).min(1, "a campaign needs at least one account"),
}).strict();

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
    /** Every address this system has, and what each one is allowed to do.

        Driven from SENDERS rather than from the config document, so a domain
        that exists but has not been switched on is still visible. Leaving it
        out was how a domain could be bought, set up, and then quietly missing
        from the only page that lists what we send as. */
    senders: SENDERS.map((x) => {
      const d = cfg.domains.find((y) => y.domain === x.domain);
      return {
        domain: x.domain,
        address: fromAddress(cfg, x.domain),
        manual_only: Boolean(d?.manual_only),
        /** Whether it can send at all today: configured and switched on. */
        sends: Boolean(d?.enabled),
        listen_inbound: Boolean(d?.listen_inbound),
        daily_cap: d ? (d.daily_cap ?? cfg.default_daily_cap) : null,
      };
    }).filter((x) => x.address),
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
  /* What this campaign has already said to this person — not what every
     campaign has. A round 2 that quotes another campaign's round 1 back at
     the reader is worse than one that quotes nothing. */
  const campaign = await campaignFor(body.contact_id ? (await crm.contact(body.contact_id))?.account_id ?? null : null);
  const prior = (await allSends())
    .filter((s) => s.contact_id === body.contact_id && s.status !== "canceled"
                   && s.campaign_id === (campaign?.id ?? null));
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
  res.json(await optOut(email, "manual", "added from the panel"));
}));

/** Our own record of who asked to be left alone, and how they told us.

    Separate from /suppressions, which is Resend's list: that one is the
    enforcement and includes every bounce and spam complaint; this one is the
    evidence, and only contains people who actually asked. */
outreachRouter.get("/optouts", h(async (_req, res) => {
  res.json({ records: await allOptOuts() });
}));

/** Puts somebody back on the list, deliberately.

    Separate route, separate verb, and it never happens as a side effect of
    anything else: un-suppressing an address is not the mirror image of
    suppressing one, and it should be hard to do by accident. The row is kept
    and marked rather than deleted, so the fact that they once asked survives
    the reversal. */
outreachRouter.post("/optouts/restore", h(async (req, res) => {
  const body = req.body as { email?: string; note?: string };
  if (!body.email) { res.status(400).json({ error: "email is required" }); return; }
  const out = await optBackIn(body.email, body.note?.trim() || null);
  if (!out.found) {
    res.status(404).json({ error: "not-opted-out",
                           detail: `${out.email} is not on the opt-out list.` });
    return;
  }
  res.json(out);
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

/** Who is asking. Always set behind the sign-in check; throwing rather than
    falling back to a default keeps one person's read state from ever landing
    in a bucket both of them share. */
const me = (req: Request): string => {
  if (!req.userEmail) throw new Error("no signed-in user on the request");
  return req.userEmail;
};

const unreadIn = async (req: Request) => withReads(await threads(), await getSeen(me(req)));

/** One conversation per person: everything sent, everything that came back,
    in order. What the Inbox renders — with what the caller has not read yet,
    since two people read this inbox and each has their own unread. */
outreachRouter.get("/threads", h(async (req, res) => {
  const list = await unreadIn(req);
  res.json({ threads: list, unread: list.filter((t) => t.unread > 0).length });
}));

/** Just the number, for the badge beside the Inbox tab. Conversations, not
    messages, as Gmail counts them: three replies in one thread is one thing
    to go and read. */
outreachRouter.get("/unread", h(async (req, res) => {
  res.json({ unread: (await unreadIn(req)).filter((t) => t.unread > 0).length });
}));

const ReadRequest = z.object({
  marks: z.array(z.object({
    key: z.string().min(1).max(1000),
    through: z.string().min(1).max(64).nullable(),
  }).strict()).min(1).max(2000),
}).strict();

/** Marks threads read through a given message, or unread again. The client
    says how far it read rather than the server stamping "now" — reads.ts has
    why that difference loses mail. */
outreachRouter.post("/threads/read", h(async (req, res) => {
  const { marks } = ReadRequest.parse(req.body);
  await markSeen(me(req), marks);
  res.json({ ok: true });
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
      /* This campaign's own messages. Keyed on campaign_id, never on account:
         two campaigns aimed at one company each report their own work, and a
         campaign created today starts at zero instead of inheriting whatever
         was sent to those companies last week. */
      const mine = sends.filter((s) => s.campaign_id === c.id && s.status !== "canceled");
      const mineIds = new Set(mine.map((s) => s.id));
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
        // A reply belongs to the campaign whose message it answers, which is
        // what send_id records. A reply we could not attribute to a send is
        // nobody's to claim.
        replies: replies.filter((r) => !r.automated && r.send_id
                                       && mineIds.has(r.send_id)).length,
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
/** Creates a campaign, or edits one that exists.

    Always lands switched off, whatever the body says. Creating a campaign and
    starting one are different decisions — the second spends Apollo credits
    and writes to strangers — and collapsing them into one form would make a
    typo in the accounts field expensive. Activation is its own button. */
outreachRouter.post("/campaigns", h(async (req, res) => {
  const body = NewCampaign.parse(req.body);
  const existing = (await allCampaigns()).find((c) => c.id === body.id);
  if (!existing && (await allCampaigns()).some((c) => c.name === body.name)) {
    res.status(409).json({ error: "duplicate-name",
                           detail: `A campaign called “${body.name}” already exists.` });
    return;
  }
  const c = Campaign.parse({
    ...body,
    // Editing keeps whatever it was; a new one is always off.
    active: existing?.active ?? false,
    created_at: existing?.created_at || new Date().toISOString(),
    deleted_at: null,
  });
  await putCampaign(c);
  res.json(c);
}));

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

/** Pause, and pull the queue back with it — for when the campaign itself was
    the mistake, not the timing. Messages already sent stay sent; one-offs
    written by hand to these accounts are left alone. */
outreachRouter.post("/campaigns/:id/end", h(async (req, res) => {
  const c = (await allCampaigns()).find((x) => x.id === req.params.id);
  if (!c) { res.status(404).json({ error: `no campaign with id ${req.params.id}` }); return; }
  await putCampaign({ ...c, active: false });
  res.json({ id: c.id, active: false, ...(await endCampaign(c)) });
}));

/** Refuses while the campaign is running. Deleting is the one campaign
    action that cannot be undone, and it must never be the thing that leaves
    mail in the queue with nothing left to explain why it was written. */
outreachRouter.delete("/campaigns/:id", h(async (req, res) => {
  const c = (await allCampaigns()).find((x) => x.id === req.params.id);
  if (!c) { res.status(404).json({ error: `no campaign with id ${req.params.id}` }); return; }
  if (c.active) {
    res.status(409).json({ error: "still-running",
                           detail: "End or pause this campaign before deleting it." });
    return;
  }
  await deleteCampaign(c.id);
  res.json({ id: c.id, deleted: true });
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
