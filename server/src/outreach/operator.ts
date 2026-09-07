import { Agent } from "@mastra/core/agent";
import { TokenLimiter, ToolCallFilter } from "@mastra/core/processors";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { draft, modelConfigured } from "./agent.js";
import { blockers } from "./config.js";
import * as crm from "./crm.js";
import { heatmap } from "./heatmap.js";
import { cancel, Refused, schedule } from "./send.js";
import {
  allCampaigns, allReplies, allSends, appendTurns, getConfig, getThread, headroom,
  lastTick, putCampaign, type ChatTurn,
} from "./store.js";
import { Campaign } from "./schemas.js";
import { due } from "./tick.js";

/* The operator: the agent you talk to instead of clicking.

   This is where tools belong. The writer agent has none, because writing one
   email depends on facts we already know. Here we do not know what the
   operator will ask for — "who at Bernhard Schulte have we not touched",
   "cancel the one to Ana", "what is left today" — so the agent has to be able
   to go and look, and to act.

   Every tool that changes anything goes through the same functions the HTTP
   routes use. The daily cap, the dry-run switch, the placeholder check and
   the blocker list are enforced in send.ts, not here, so no amount of
   confused instruction-following can talk its way past them. */

const t = {
  status: createTool({
    id: "outreach-status",
    description:
      "The state of the outreach system: what is blocking sending, how many sends each domain has left today, and when the heartbeat last ran.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      blockers: z.array(z.object({ code: z.string(), detail: z.string() })),
      dry_run: z.boolean(),
      auto_followups: z.boolean(),
      domains: z.array(z.object({ domain: z.string(), used: z.number(), cap: z.number(), left: z.number() })),
      last_beat: z.string().nullable(),
    }),
    execute: async () => {
      const cfg = await getConfig();
      const [rooms, beat] = await Promise.all([headroom(cfg), lastTick()]);
      return {
        blockers: blockers(cfg), dry_run: cfg.dry_run, auto_followups: cfg.auto_followups,
        domains: rooms.map(({ domain, used, cap, left }) => ({ domain, used, cap, left })),
        last_beat: beat?.at ?? null,
      };
    },
  }),

  findPeople: createTool({
    id: "find-people",
    description:
      "Search the CRM for people. Filter by company name, person name, or buying role. Returns contact ids, which every other tool needs.",
    inputSchema: z.object({
      company: z.string().nullish().describe("Substring of the company name"),
      name: z.string().nullish().describe("Substring of the person's name"),
      role: z.string().nullish().describe("Substring of their title or buying role"),
      only_with_email: z.boolean().nullish().describe("Default true; people with no address cannot be mailed"),
      limit: z.number().nullish(),
    }),
    outputSchema: z.object({
      matched: z.number(),
      people: z.array(z.object({
        contact_id: z.string(), full_name: z.string(), title: z.string(),
        company: z.string().nullable(), has_email: z.boolean(),
        priority: z.number(), status: z.string(), replied: z.boolean(),
      })),
    }),
    execute: async ({ company, name, role, only_with_email, limit }) => {
      const has = (hay: string | null | undefined, needle?: string | null) =>
        !needle || (hay ?? "").toLowerCase().includes(needle.toLowerCase());
      const all = (await crm.contacts()).filter((c) =>
        has(c.company, company) && has(c.full_name, name) &&
        (has(c.title, role) || has(c.buying_role, role)) &&
        (only_with_email === false || Boolean(c.email)));
      return {
        matched: all.length,
        people: all.slice(0, limit ?? 25).map((c) => ({
          contact_id: c.id, full_name: c.full_name, title: c.title, company: c.company,
          has_email: Boolean(c.email), priority: c.priority, status: c.status, replied: c.replied,
        })),
      };
    },
  }),

  listCampaigns: createTool({
    id: "list-campaigns",
    description:
      "Every campaign: a persona and a message (borrowed from one tier's template) aimed at a chosen " +
      "list of accounts, independent of those accounts' own tier.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      records: z.array(z.object({
        id: z.string(), name: z.string(), persona: z.string(), template_tier: z.number(),
        account_ids: z.array(z.string()), active: z.boolean(),
      })),
    }),
    execute: async () => ({
      records: (await allCampaigns()).map(
        ({ id, name, persona, template_tier, account_ids, active }) =>
          ({ id, name, persona, template_tier, account_ids, active })),
    }),
  }),

  setCampaign: createTool({
    id: "set-campaign",
    description:
      "Create or update a campaign: aim a persona and a tier's message at a chosen list of accounts, " +
      "regardless of those accounts' own tier — companies and campaigns are independent. Pass the same " +
      "id again to change its accounts, persona, template or active flag.",
    inputSchema: z.object({
      id: z.string().describe("A short slug, e.g. 'cfo-risk-push'. Reuse it to update this campaign."),
      name: z.string(),
      persona: z.string().describe("Who this message is written for, e.g. 'risk-averse CFO'"),
      template_tier: z.number().int().describe("Which existing sequence's copy this campaign's message borrows"),
      account_ids: z.array(z.string()).describe("Account ids in this campaign, any tier, from find-people or the CRM"),
      active: z.boolean().nullish(),
    }),
    outputSchema: z.object({ id: z.string(), active: z.boolean() }),
    execute: async (input) => {
      const c = Campaign.parse({ ...input, active: input.active ?? true, created_at: new Date().toISOString() });
      await putCampaign(c);
      return { id: c.id, active: c.active };
    },
  }),

  activity: createTool({
    id: "account-activity",
    description:
      "How much each account has been sent and what came back, by week. Use it to answer 'who is being neglected' and 'who are we hitting too hard'.",
    inputSchema: z.object({ weeks: z.number().nullish(), company: z.string().nullish() }),
    outputSchema: z.object({
      totals: z.object({ sent: z.number(), planned: z.number(), replies: z.number(),
                         bounces: z.number(), accounts_touched: z.number(), accounts: z.number() }),
      accounts: z.array(z.object({
        company: z.string(), tier: z.number(), sent: z.number(), planned: z.number(),
        replies: z.number(), bounces: z.number(), last_sent: z.string().nullable(),
      })),
    }),
    execute: async ({ weeks, company }) => {
      const [sends, replies] = await Promise.all([allSends(), allReplies()]);
      const map = await heatmap(sends, replies, weeks ?? 12);
      const rows = company
        ? map.rows.filter((r) => r.company.toLowerCase().includes(company.toLowerCase()))
        : map.rows;
      return {
        totals: map.totals,
        accounts: rows.slice(0, 40).map((r) => ({
          company: r.company, tier: r.tier, sent: r.total.sent, planned: r.total.planned,
          replies: r.total.replies, bounces: r.total.bounces, last_sent: r.last_sent,
        })),
      };
    },
  }),

  owed: createTool({
    id: "who-is-owed-a-follow-up",
    description:
      "People whose last message landed, whose cadence has elapsed, who have not replied, and whose next round has not been written yet.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      records: z.array(z.object({
        contact_id: z.string(), company: z.string().nullable(),
        next_round: z.number(), last_at: z.string(),
      })),
    }),
    execute: async () => {
      const cfg = await getConfig();
      const [sends, replies] = await Promise.all([allSends(), allReplies()]);
      return { records: due(cfg, sends, replies).map((d) => ({
        contact_id: d.contact_id, company: d.company, next_round: d.next_round, last_at: d.last_at,
      })) };
    },
  }),

  write: createTool({
    id: "draft-email",
    description:
      "Write a message for one person and one round, WITHOUT sending or scheduling it. Always do this and show the operator the result before scheduling anything.",
    inputSchema: z.object({
      contact_id: z.string(),
      round: z.number().min(1).max(3),
      guidance: z.string().nullish().describe("Any extra steer for this particular message"),
    }),
    outputSchema: z.object({
      subject: z.string(), body: z.string(), why: z.string(),
      template_tier: z.number(), unresolved: z.array(z.string()),
    }),
    execute: async ({ contact_id, round, guidance }) => {
      const cfg = await getConfig();
      return draft(contact_id, round as 1 | 2 | 3, cfg,
                   { useModel: modelConfigured(), guidance: guidance ?? null,
                     prior: (await allSends()).filter((s) => s.contact_id === contact_id
                                                          && s.status !== "canceled") });
    },
  }),

  book: createTool({
    id: "schedule-email",
    description:
      "Schedule a message. Only call this after showing the operator the exact subject and body and being told to go ahead in this conversation. It counts against the sending domain's cap for the day, and it can be cancelled until it goes.",
    inputSchema: z.object({
      contact_id: z.string(),
      round: z.number().min(1).max(3),
      subject: z.string(),
      body: z.string(),
      confirmed_by_operator: z.boolean()
        .describe("True only if the operator said yes to this exact message in this conversation."),
      scheduled_at: z.string().nullish().describe("ISO instant; omit for the next free slot"),
    }),
    outputSchema: z.object({
      scheduled: z.boolean(), send_id: z.string().nullable(), cancel_token: z.string().nullable(),
      scheduled_at: z.string().nullable(), domain: z.string().nullable(),
      used: z.number().nullable(), cap: z.number().nullable(),
      dry_run: z.boolean().nullable(), refused: z.string().nullable(),
    }),
    execute: async (input) => {
      const no = (why: string) => ({
        scheduled: false, send_id: null, cancel_token: null, scheduled_at: null,
        domain: null, used: null, cap: null, dry_run: null, refused: why,
      });
      if (!input.confirmed_by_operator) return no("not confirmed by the operator — ask first");
      try {
        const cfg = await getConfig();
        const r = await schedule({
          contact_id: input.contact_id, round: input.round as 1 | 2 | 3,
          subject: input.subject, body: input.body,
          scheduled_at: input.scheduled_at ?? null, domain: null,
          written_by: modelConfigured() ? "agent" : "template", template_tier: null,
        }, cfg, await allSends());
        return { scheduled: true, send_id: r.id, cancel_token: r.cancel_token,
                 scheduled_at: r.scheduled_at, domain: r.domain, used: r.used, cap: r.cap,
                 dry_run: r.dry_run, refused: null };
      } catch (err) {
        return no(err instanceof Refused ? `${err.code}: ${err.message}`
                                         : err instanceof Error ? err.message : String(err));
      }
    },
  }),

  queue: createTool({
    id: "list-queue",
    description: "Messages that are scheduled and still cancellable, soonest first.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      records: z.array(z.object({
        send_id: z.string(), to: z.string(), company: z.string().nullable(),
        subject: z.string(), round: z.number(), scheduled_at: z.string().nullable(),
        dry_run: z.boolean(),
      })),
    }),
    execute: async () => ({
      records: (await allSends())
        .filter((s) => s.status === "scheduled" || s.status === "draft")
        .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
        .map((s) => ({ send_id: s.id, to: s.to, company: s.company, subject: s.subject,
                       round: s.round, scheduled_at: s.scheduled_at, dry_run: s.dry_run })),
    }),
  }),

  pull: createTool({
    id: "cancel-email",
    description:
      "Pull a scheduled message back before it goes, and return its slot to the day's budget. Works only while it is still scheduled.",
    inputSchema: z.object({ send_id: z.string() }),
    outputSchema: z.object({ canceled: z.boolean(), note: z.string() }),
    execute: async ({ send_id }) => {
      try {
        const r = await cancel(send_id);
        return { canceled: true, note: r.note };
      } catch (err) {
        return { canceled: false, note: err instanceof Error ? err.message : String(err) };
      }
    },
  }),
};

const INSTRUCTIONS = `
You run the outreach side of a CRM for a company that builds autonomous
vessels escorting commercial ships through high-risk passages. You are talking
to the person who owns this pipeline. Do what they ask, using the tools.

How to behave:

- Look things up rather than guessing. You have tools for people, activity,
  who is owed a follow-up, the queue, and system status.
- A campaign assigns a persona and one tier's message to a chosen list of
  accounts, independent of those accounts' real tier — use set-campaign when
  asked to target a persona or a different message across specific companies,
  not the write/schedule tools directly. Drafting for someone in a campaign
  automatically uses that campaign's message; you do not need to pass it.
- Never schedule anything without first showing the exact subject and body and
  getting a clear yes in this conversation. Set confirmed_by_operator only
  after they have said so. "Draft one for Ana" is not permission to send it.
- When asked to reach several people, draft them, show them, and ask once for
  the whole batch. Do not schedule one at a time hoping nobody notices.
- If a schedule is refused, say plainly why. A full daily cap is normal and
  expected, not an error to route around — never try another domain or a
  different date to get past it unless you are asked to.
- Report what actually happened. If four of six were scheduled and two were
  refused, say that, and say which.
- Cancelling is cheap and safe while a message is scheduled. Offer it when
  someone sounds unsure.
- Be brief. Short sentences, no bullet-point essays, no restating the request
  back before answering. You are a colleague at a terminal, not a report.
- You will not see the results of tools you called in earlier turns, only what
  you said about them. That is deliberate: the pipeline moves, and a count
  from ten minutes ago may be wrong. Never answer from what you said before —
  call the tool again. It is cheap.
`.trim();

let cached: { model: string; agent: Agent } | null = null;

function operator(model: string): Agent {
  if (cached?.model !== model) {
    cached = { model, agent: new Agent({
      id: "outreach-operator", name: "Outreach operator",
      instructions: INSTRUCTIONS, model, tools: t,
      inputProcessors: [
        /* Two problems, one processor.

           ToolCallFilter drops tool calls and their results from the prompt
           for *earlier* turns, while leaving the current loop's own results
           in place — so the agent can still reason about what it just looked
           up, but next turn it has no stale numbers to answer from and has to
           go and look again. That is what we want: this pipeline moves, and a
           headroom figure from ten minutes ago is a lie waiting to happen.

           It also keeps the thread cheap. A tool that returns forty accounts
           would otherwise sit in the prompt for the rest of the conversation.
           The filter is transient — the stored thread keeps everything, so
           the audit trail is intact; only the model's view is trimmed. */
        new ToolCallFilter(),
        // A hard ceiling under all of it. Preserves system messages and keeps
        // the most recent turns, so a long conversation degrades by
        // forgetting the beginning rather than by failing.
        new TokenLimiter(12_000),
      ],
    }) };
  }
  return cached.agent;
}

/** One turn of conversation against the shared thread.

    Mastra has its own memory and threads, but they need a storage adapter
    that implements the `memory` domain — libSQL, Postgres, Mongo — and there
    is no Firestore one. Standing up a second database to hold eighty chat
    messages would undo the point of having one. So the thread lives in
    Firestore next to everything else and is replayed into `generate()`.

    What that costs us is Mastra's semantic recall and working memory, neither
    of which this needs. What it does not cost us is the context management:
    ToolCallFilter and TokenLimiter are plain processors and work on any
    message list, storage adapter or not. */
export async function chat(message: string): Promise<{ text: string; thread: ChatTurn[] }> {
  const cfg = await getConfig();
  const history = await getThread();
  const now = new Date().toISOString();

  // The whole thread goes in; TokenLimiter decides what actually fits. That
  // is a better cut than a fixed number of turns, which is either wasteful
  // for short exchanges or lossy for long ones.
  const context = [...history, { role: "user" as const, content: message, at: now }];

  // Mapped one at a time so each role is a literal type: a `role: string`
  // does not satisfy the SDK's message union.
  const input = context.map((m) =>
    m.role === "user"
      ? { role: "user" as const, content: m.content }
      : { role: "assistant" as const, content: m.content });

  const res = await operator(cfg.model).generate(input);

  // Both turns are written together, after the model answers. A failed call
  // therefore leaves no half-turn in the thread for the next person to
  // puzzle over.
  const thread = await appendTurns([
    { role: "user", content: message, at: now },
    { role: "assistant", content: res.text, at: new Date().toISOString() },
  ]);
  return { text: res.text, thread };
}
