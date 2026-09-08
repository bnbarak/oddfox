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
  contact_id: string;
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

const outbound = (s: SendRecord): ThreadMessage => ({
  dir: "out", id: s.id, subject: s.subject, body: s.body,
  at: s.scheduled_at ?? s.created_at, status: s.status, round: s.round,
  dry_run: s.dry_run, cancel_token: s.resend_id,
});

const inbound = (r: ReplyRecord): ThreadMessage => ({
  dir: "in", id: r.id, subject: r.subject, body: r.excerpt,
  at: r.received_at, automated: r.automated, unsubscribe: r.unsubscribe,
});

export async function threads(): Promise<Thread[]> {
  const [sends, replies, contacts] = await Promise.all([allSends(), allReplies(), crm.contacts()]);

  const byContact = new Map<string, ThreadMessage[]>();
  const push = (id: string | null, m: ThreadMessage) => {
    if (!id) return;
    byContact.set(id, [...(byContact.get(id) ?? []), m]);
  };
  for (const s of sends) push(s.contact_id, outbound(s));
  for (const r of replies) push(r.contact_id, inbound(r));

  const out: Thread[] = [];
  for (const [contactId, messages] of byContact) {
    const c = contacts.find((x) => x.id === contactId);
    if (!c) continue;
    messages.sort((a, b) => a.at.localeCompare(b.at));
    const human = messages.filter((m) => m.dir === "in" && !m.automated);
    out.push({
      contact_id: contactId,
      full_name: c.full_name,
      title: c.title,
      company: c.company,
      account_id: c.account_id,
      email: c.email,
      last_at: messages[messages.length - 1]!.at,
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
