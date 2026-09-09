import * as crm from "./crm.js";
import { allReplies, allSends, type ReplyRecord } from "./store.js";
import type { SendRecord } from "./schemas.js";

/* One conversation per person: what we sent and what came back, in order.

   The queue and the reply list answer "what is happening"; this answers "what
   have we actually said to this person", which is the question you need before
   writing to them again. Built by grouping in memory — a few hundred documents
   makes a join pointless. */

export type ThreadMessage = {
  dir: "out" | "in";
  /** When this counts as having happened, for ordering.

      Not the same as `at`. An outbound message shows the time it lands, which
      is in the future while it is still queued — sorting on that floats a
      message you have not sent above mail that genuinely arrived later. So
      ordering uses the moment it was written until it actually goes. */
  sort_at: string;
  id: string;
  subject: string | null;
  body: string | null;
  at: string;
  /** Outbound only: where the message got to, and whether it is still pullable. */
  status?: string;
  round?: number;
  dry_run?: boolean;
  cancel_token?: string | null;
  /** Inbound only. */
  automated?: boolean;
  unsubscribe?: boolean;
};

export type Thread = {
  /** The contact id, or the bare address for someone outside the CRM. */
  key: string;
  contact_id: string | null;
  full_name: string;
  title: string;
  company: string | null;
  account_id: string | null;
  email: string | null;
  last_at: string;
  sent: number;
  replies: number;
  replied: boolean;
  messages: ThreadMessage[];
};

/** Strips reply and forward prefixes so "Re: Marine Security" and "Marine
    Security" are recognised as the same conversation. Repeated because mail
    clients stack them: "Re: Fwd: Re: ...". */
export function normaliseSubject(subject: string | null | undefined): string {
  let t = (subject ?? "").trim();
  for (;;) {
    const next = t.replace(/^(re|fwd?|aw|sv|vs|antw)\s*(\[\d+\])?\s*:\s*/i, "");
    if (next === t) break;
    t = next;
  }
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

/** What makes two messages the same conversation.

    Keyed by counterparty *and* subject, not by person: two unrelated notes
    from the same address are two conversations, and stacking them into one
    thread makes the second look like a reply to the first. A message with no
    subject stands alone under its own id rather than collapsing every
    subjectless message from that address together. */
const threadKey = (who: string, subject: string | null, id: string): string => {
  const norm = normaliseSubject(subject);
  return norm ? `${who.toLowerCase()}|${norm}` : `${who.toLowerCase()}|#${id}`;
};

const GONE = new Set(["sent", "delivered", "opened", "clicked", "bounced", "complained"]);

const outbound = (s: SendRecord): ThreadMessage => ({
  dir: "out", id: s.id, subject: s.subject, body: s.body,
  at: s.scheduled_at ?? s.created_at,
  sort_at: GONE.has(s.status) ? (s.scheduled_at ?? s.created_at) : s.created_at,
  status: s.status, round: s.round,
  dry_run: s.dry_run, cancel_token: s.resend_id,
});

const inbound = (r: ReplyRecord): ThreadMessage => ({
  dir: "in", id: r.id, subject: r.subject, body: r.excerpt,
  at: r.received_at, sort_at: r.received_at,
  automated: r.automated, unsubscribe: r.unsubscribe,
});

export async function threads(): Promise<Thread[]> {
  const [sends, replies, contacts] = await Promise.all([allSends(), allReplies(), crm.contacts()]);

  /* Keyed by contact where there is one, and by address otherwise — a note
     to somebody outside the CRM is still a conversation, and dropping it
     would make the Inbox quietly incomplete. */
  const byKey = new Map<string, { key: string; contact_id: string | null; to: string | null;
                                  messages: ThreadMessage[] }>();
  const push = (key: string | null, contactId: string | null, addr: string | null, m: ThreadMessage) => {
    if (!key) return;
    const cur = byKey.get(key) ?? { key, contact_id: contactId, to: addr, messages: [] };
    cur.messages.push(m);
    cur.contact_id ??= contactId;
    cur.to ??= addr;
    byKey.set(key, cur);
  };
  const bare = (a: string) => (a.match(/<([^>]+)>/)?.[1] ?? a).trim();
  for (const s of sends) {
    push(threadKey(bare(s.to), s.subject, s.id), s.contact_id, s.to, outbound(s));
  }
  for (const r of replies) {
    push(threadKey(bare(r.from), r.subject, r.id), r.contact_id, r.from, inbound(r));
  }

  const out: Thread[] = [];
  for (const [key, t] of byKey) {
    const c = t.contact_id ? contacts.find((x) => x.id === t.contact_id) : undefined;
    const messages = t.messages;
    messages.sort((a, b) => a.sort_at.localeCompare(b.sort_at));
    const human = messages.filter((m) => m.dir === "in" && !m.automated);
    /* A cancelled message never happened, so it cannot be what makes a
       thread recent — that is what pushed a dead draft above real mail. */
    const live = messages.filter((m) => m.status !== "canceled");
    out.push({
      key,
      contact_id: t.contact_id,
      full_name: c?.full_name ?? t.to ?? key,
      title: c?.title ?? "",
      company: c?.company ?? null,
      account_id: c?.account_id ?? null,
      email: c?.email ?? t.to ?? null,
      last_at: (live[live.length - 1] ?? messages[messages.length - 1]!).sort_at,
      sent: messages.filter((m) => m.dir === "out" && m.status !== "canceled").length,
      replies: human.length,
      replied: human.length > 0,
      messages,
    });
  }

  // Most recent activity first — a thread that just got a reply is the one
  // you want at the top.
  out.sort((a, b) => b.last_at.localeCompare(a.last_at));
  return out;
}
