import { z } from "zod";
import type { AccountRecord, ContactRecord } from "../schemas.js";
import { LANDED } from "./campaignState.js";
import * as crm from "./crm.js";
import type { Sequence } from "./crm.js";
import type { Campaign, SendRecord } from "./schemas.js";
import { allCampaigns, allSends } from "./store.js";
import { threads, type Thread, type ThreadMessage } from "./threads.js";

/* Where the operator is, told to the agent.

   The dock sends what the page under it is showing with every question —
   ids, and a draft if one is being written — and this turns that into a
   short brief the model gets as a system message for that turn only. It is
   what makes "is this one worth chasing?" over an open email mean that email.

   Looked up here rather than taken from the browser: the brief says what the
   record says now, where a tab can only say what it last polled. Loading is
   kept apart from writing so the writing can be checked without Firestore. */

const id = z.string().min(1).max(400);
const addresses = z.array(z.string().max(320)).max(50);

export const PageContext = z.object({
  page: z.string().max(60),
  page_label: z.string().max(60),
  /** The dock's "on" line, kept with the question in the shared thread. */
  label: z.string().max(400),
  thread: id.nullish(),
  campaign: id.nullish(),
  campaigns: z.array(id).max(200).nullish(),
  account: id.nullish(),
  tier: z.number().int().min(0).max(99).nullish(),
  view: z.string().max(400).nullish(),
  draft: z.object({
    reply: z.boolean(), to: addresses, cc: addresses, bcc: addresses,
    subject: z.string().max(2000), body: z.string().max(20_000),
  }).nullish(),
}).strict();
export type PageContext = z.infer<typeof PageContext>;

export type Facts = {
  threads: Thread[]; campaigns: Campaign[]; accounts: AccountRecord[];
  contacts: ContactRecord[]; sends: SendRecord[]; sequence: Sequence | null;
};

/* Enough to answer about what is open without paying for all of it: a long
   thread keeps its last few messages, each cut short, and the whole brief has
   a ceiling. The operator's TokenLimiter works under the same budget. */
const LAST_MESSAGES = 8;
const MESSAGE_CHARS = 1500;
const DRAFT_CHARS = 4000;
const LIST_LIMIT = 40;
const BRIEF_CHARS = 16_000;

const clip = (s: string | null | undefined, n: number): string => {
  const t = (s ?? "").replace(/\n{3,}/g, "\n\n").trim();
  return t.length > n ? `${t.slice(0, n)}… [cut]` : t;
};
const when = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const HEAD =
  "Where the operator is right now. When they say \"this\", \"this email\", \"them\", " +
  "\"this campaign\" or \"here\", they mean what is described below. It was taken as they " +
  "asked; call the tools for anything else, or for anything that might have moved since.";

/** The brief for one question, with whatever it needs looked up. */
export async function describe(ctx: PageContext): Promise<string> {
  const wantCampaigns = Boolean(ctx.campaign || ctx.campaigns?.length || ctx.account);
  const [ts, campaigns, accounts, contacts, sends, tmpl] = await Promise.all([
    ctx.thread ? threads() : [],
    wantCampaigns ? allCampaigns() : [],
    wantCampaigns ? crm.accounts() : [],
    wantCampaigns ? crm.contacts() : [],
    ctx.campaign || ctx.campaigns?.length ? allSends() : [],
    ctx.tier != null ? crm.template(ctx.tier, 1) : null,
  ]);
  // template() falls back to tier 1 for a tier with no sequence of its own,
  // which is right for writing and wrong for saying what is on screen.
  const sequence = tmpl && tmpl.seq.tier === ctx.tier ? tmpl.seq : null;
  return brief(ctx, { threads: ts, campaigns, accounts, contacts, sends, sequence });
}

export function brief(ctx: PageContext, f: Facts): string {
  const out = [HEAD, "", `Page: ${ctx.page_label}.`];
  if (ctx.view) out.push(`On screen: ${ctx.view}.`);
  if (ctx.thread) out.push("", ...aboutThread(ctx.thread, f.threads));
  if (ctx.draft) out.push("", ...aboutDraft(ctx.draft));
  if (ctx.campaign) out.push("", ...aboutCampaign(ctx.campaign, f));
  else if (ctx.campaigns?.length) out.push("", ...listCampaigns(ctx.campaigns, f));
  if (ctx.account) out.push("", ...aboutAccount(ctx.account, f));
  if (ctx.tier != null) out.push("", aboutTier(ctx.tier, f.sequence));
  return clip(out.join("\n"), BRIEF_CHARS);
}

function aboutThread(key: string, all: Thread[]): string[] {
  const t = all.find((x) => x.key === key);
  if (!t) return ["They had an email conversation open that no longer exists."];
  const who = [t.full_name, t.title, t.company].filter(Boolean).join(", ");
  const ids = [t.contact_id && `contact_id ${t.contact_id}`, t.account_id && `account_id ${t.account_id}`]
    .filter(Boolean).join(", ");
  const out = [
    `They have this email conversation open: ${who} <${t.email ?? "no address on record"}>` +
    `${ids ? ` (${ids})` : ""}. ${plural(t.sent, "message")} sent to them, ` +
    `${plural(t.replies, "reply", "replies")} back.`,
  ];
  const shown = t.messages.slice(-LAST_MESSAGES);
  if (t.messages.length > shown.length) {
    out.push(`${plural(t.messages.length - shown.length, "earlier message")} not shown here.`);
  }
  out.push("Messages, oldest first:");
  for (const m of shown) out.push("", ...message(m, t.full_name));
  return out;
}

function message(m: ThreadMessage, name: string): string[] {
  const head = m.dir === "in"
    ? [`From ${name}`, when(m.at), m.automated && "automatic reply",
       m.unsubscribe && "asked to be taken off the list"]
    : ["From us", m.round ? `round ${m.round}` : "written by hand",
       m.dry_run ? "dry run, never sent" : m.status, when(m.at), `send_id ${m.id}`];
  const group = m.dir === "out" && (m.also_to?.length || m.cc?.length || m.bcc?.length)
    ? [`To: ${[m.to, ...(m.also_to ?? [])].filter(Boolean).join(", ")}`,
       m.cc?.length ? `Cc: ${m.cc.join(", ")}` : null,
       m.bcc?.length ? `Bcc: ${m.bcc.join(", ")}` : null].filter(Boolean).join(" · ")
    : null;
  return [
    `— ${head.filter(Boolean).join(" · ")}`,
    ...(m.subject ? [`Subject: ${m.subject}`] : []),
    ...(group ? [group] : []),
    clip(m.body, MESSAGE_CHARS) || "(no text)",
  ];
}

function aboutDraft(d: NonNullable<PageContext["draft"]>): string[] {
  const rcpt = [`To: ${d.to.join(", ") || "nobody yet"}`,
                d.cc.length ? `Cc: ${d.cc.join(", ")}` : null,
                d.bcc.length ? `Bcc: ${d.bcc.join(", ")}` : null].filter(Boolean).join(" · ");
  return [
    d.reply ? "They are writing a reply in this conversation. It has not been sent:"
            : "They are writing a new email. It has not been sent:",
    rcpt,
    `Subject: ${d.subject.trim() || "(none yet)"}`,
    clip(d.body, DRAFT_CHARS) || "(nothing written yet)",
    "You cannot type into their draft. If they want it changed, write the new text in your " +
    "answer for them to paste.",
  ];
}

const companies = (c: Campaign, f: Facts): string => {
  const names = c.account_ids.map((a) => `${f.accounts.find((r) => r.id === a)?.company ?? a} (${a})`);
  return names.length > 8 ? `${names.slice(0, 8).join(", ")} and ${names.length - 8} more`
                          : names.join(", ");
};

function aboutCampaign(cid: string, f: Facts): string[] {
  const c = f.campaigns.find((x) => x.id === cid);
  if (!c) return [`They had the campaign ${cid} open, which no longer exists.`];
  const people = f.contacts.filter((p) => p.account_id && c.account_ids.includes(p.account_id));
  // This campaign's own messages, keyed on campaign_id as the Campaigns table counts them.
  const mine = f.sends.filter((s) => s.campaign_id === c.id && s.status !== "canceled");
  const queued = mine.filter((s) => s.status === "scheduled" || s.status === "draft").length;
  const landed = mine.filter((s) => LANDED.has(s.status)).length;
  return [
    `They are looking at the campaign "${c.name}" (id ${c.id}), ` +
    `${c.active ? "switched on" : "switched off"}.`,
    `Persona: ${c.persona}. Its message is tier ${c.template_tier}'s sequence.`,
    `Accounts: ${companies(c, f)}.`,
    `${plural(people.length, "person", "people")} in it, ${people.filter((p) => p.email).length} ` +
    `with an address; ${queued} queued, ${landed} sent.`,
  ];
}

function listCampaigns(ids: string[], f: Facts): string[] {
  const rows = ids.map((i) => f.campaigns.find((c) => c.id === i))
    .filter((c): c is Campaign => Boolean(c));
  return [
    `The campaigns table is listing ${plural(rows.length, "campaign")}, in this order:`,
    ...rows.slice(0, LIST_LIMIT).map((c) =>
      `- "${c.name}" (id ${c.id}), ${c.active ? "on" : "off"}: ${companies(c, f)}`),
    ...(rows.length > LIST_LIMIT ? [`…and ${rows.length - LIST_LIMIT} more.`] : []),
  ];
}

function aboutAccount(aid: string, f: Facts): string[] {
  const a = f.accounts.find((r) => r.id === aid);
  if (!a) return [`They had an account page open (${aid}) that no longer exists.`];
  const people = f.contacts.filter((p) => p.account_id === a.id);
  const aimed = f.campaigns.filter((c) => c.account_ids.includes(a.id));
  return [
    `They have the account page for ${a.company} open (account_id ${a.id}): tier ${a.tier}, ` +
    `${a.tier_name}${a.country ? `, ${a.country}` : ""}, pipeline status ${a.status}.`,
    aimed.length
      ? `Campaigns aimed at it: ${aimed.map((c) =>
          `"${c.name}" (id ${c.id}, ${c.active ? "on" : "off"})`).join(", ")}.`
      : "No campaign is aimed at it.",
    `${plural(people.length, "person", "people")} on record there:`,
    ...people.slice(0, LIST_LIMIT).map((p) =>
      `- ${p.full_name}, ${p.title} (contact_id ${p.id}${p.email ? "" : ", no address"})`),
    ...(people.length > LIST_LIMIT ? [`…and ${people.length - LIST_LIMIT} more.`] : []),
  ];
}

function aboutTier(tier: number, seq: Sequence | null): string {
  if (!seq) return `They are reading the tier ${tier} sequence.`;
  return `They are reading the tier ${tier} sequence, "${seq.tier_name}": ` +
    seq.rounds.map((r) => `round ${r.round} "${r.subject}"`).join(", ") + ".";
}
