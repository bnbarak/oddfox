import * as crm from "./crm.js";
import { allReplies, allSends, type ReplyRecord } from "./store.js";
import { clickedAt, delivery, openedAt } from "./sends.js";
import type { SendRecord } from "./schemas.js";
import type { ContactRecord } from "../schemas.js";

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
  /** The plain-text body. Always present for an outbound message; for an
      inbound one it is the text as written, line breaks kept, falling back
      to the one-line excerpt until the poller has fetched the full text. */
  body: string | null;
  /** The HTML part of an outbound message, when it has one. What the panels
      render, so the surface shows the message as its recipient saw it. */
  html?: string | null;
  at: string;
  /** Outbound only: where the message got to, and whether it is still
      pullable. Delivery only — whether anybody read it is below. */
  status?: string;
  /** Outbound only: when the recipient first opened it, and first clicked a
      link in it. Null is "not that we know of" — open tracking can be off
      at Resend, and then nothing is ever reported. */
  opened_at?: string | null;
  clicked_at?: string | null;
  round?: number;
  /** Which tier's sequence this round's copy came from, so a message can
      link back to the script it is following. */
  template_tier?: number | null;
  dry_run?: boolean;
  cancel_token?: string | null;
  /** RFC message id, when known — what a reply must reference to thread. */
  message_id?: string | null;
  /** Inbound only. */
  automated?: boolean;
  unsubscribe?: boolean;
  /** Outbound only: who it went to. The extra fields are there only for a
      group message, so a thread can show who else was on it. */
  to?: string;
  also_to?: string[];
  cc?: string[];
  bcc?: string[];
};

export type Thread = {
  /** The counterparty's address and the normalised subject — see threadKey.
      What read state is stored under. Never put it in a URL: it is data. */
  key: string;
  /** The same thread for URLs: the id of its first email. That is a UUID
      either way — ours for a message we sent (randomUUID in send.ts), or
      Resend's for one that came in (poll.ts keys replies by it) — so it
      carries nothing readable, and it never changes once the thread exists. */
  id: string;
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

/** What makes two messages the same conversation, as a first guess.

    Keyed by counterparty *and* subject, not by person: two unrelated notes
    from the same address are two conversations, and stacking them into one
    thread makes the second look like a reply to the first. A message with no
    subject stands alone under its own id rather than collapsing every
    subjectless message from that address together.

    Only a first guess, because the counterparty is not one address. Somebody
    written to at a company domain answers from their real one, from an alias,
    or a colleague answers for them, and on the address alone each of those
    arrives as a conversation of its own next to the one it belongs to. What
    joins them back up is join(), below. */
const threadKey = (who: string, subject: string | null, id: string): string => {
  const norm = normaliseSubject(subject);
  return norm ? `${who.toLowerCase()}|${norm}` : `${who.toLowerCase()}|#${id}`;
};

/** Whether a subject line says it is answering something. Mail clients all
    stamp one of these on a reply, and normaliseSubject knows the same list. */
const answers = (subject: string | null | undefined): boolean =>
  normaliseSubject(subject) !== (subject ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Merges keys that turn out to name one conversation. Plain union-find:
    keys point at a representative, and reading one follows the chain. */
class Joined {
  private up = new Map<string, string>();
  root(k: string): string {
    let r = k;
    while (this.up.get(r) && this.up.get(r) !== r) r = this.up.get(r)!;
    return r;
  }
  join(a: string, b: string): void {
    const [ra, rb] = [this.root(a), this.root(b)];
    if (ra !== rb) this.up.set(rb, ra);
  }
}

const GONE = new Set(["sent", "delivered", "opened", "clicked", "bounced", "complained"]);

const outbound = (s: SendRecord): ThreadMessage => ({
  dir: "out", id: s.id, subject: s.subject, body: s.body, html: s.html ?? null,
  at: s.scheduled_at ?? s.created_at,
  sort_at: GONE.has(s.status) ? (s.scheduled_at ?? s.created_at) : s.created_at,
  status: delivery(s), opened_at: openedAt(s), clicked_at: clickedAt(s),
  round: s.round, template_tier: s.template_tier, message_id: s.message_id,
  dry_run: s.dry_run, cancel_token: s.resend_id,
  to: s.to,
  ...(s.also_to?.length ? { also_to: s.also_to } : {}),
  ...(s.cc?.length ? { cc: s.cc } : {}),
  ...(s.bcc?.length ? { bcc: s.bcc } : {}),
});

const inbound = (r: ReplyRecord): ThreadMessage => ({
  // The message as written, line breaks and all. The excerpt is a one-line
  // preview, and only stands in for replies whose full text is not back yet.
  dir: "in", id: r.id, subject: r.subject, body: r.text || r.excerpt,
  at: r.received_at, sort_at: r.received_at, message_id: r.message_id ?? null,
  automated: r.automated, unsubscribe: r.unsubscribe,
});

/** Everything we hold, as conversations. Pure, so the grouping can be tested
    without a database; threads() is the same thing over Firestore. */
export function group(
  sends: SendRecord[], replies: ReplyRecord[], contacts: ContactRecord[],
): Thread[] {
  const bare = (a: string) => (a.match(/<([^>]+)>/)?.[1] ?? a).trim();

  /* One entry per message, with the key it would have on the address alone.
     Keyed by contact where there is one, and by address otherwise — a note
     to somebody outside the CRM is still a conversation, and dropping it
     would make the Inbox quietly incomplete. */
  type Entry = { key: string; addr: string; contact_id: string | null; m: ThreadMessage };
  const entries: Entry[] = [
    ...sends.map((s): Entry => ({
      key: threadKey(bare(s.to), s.subject, s.id), addr: s.to,
      contact_id: s.contact_id, m: outbound(s),
    })),
    ...replies.map((r): Entry => ({
      key: threadKey(bare(r.from), r.subject, r.id), addr: r.from,
      contact_id: r.contact_id, m: inbound(r),
    })),
  ];

  const joined = new Joined();

  /* What the message says it is answering, which beats any guess from the
     address or the subject: In-Reply-To and References name the exact
     message, and they are what every mail client threads on. This is why a
     send's Message-ID is worth learning from Resend (see pollEvents) — it is
     the id a reply quotes back. */
  const byMessageId = new Map<string, string>();
  for (const e of entries) if (e.m.message_id) byMessageId.set(e.m.message_id, e.key);
  const quoting = new Map<string, string[]>(
    replies.map((r) => [r.id,
      [...new Set([...(r.references ?? []), ...(r.in_reply_to ? [r.in_reply_to] : [])])]]));
  const threadedByChain = new Set<string>();
  for (const e of entries) {
    for (const ref of quoting.get(e.m.id) ?? []) {
      const target = byMessageId.get(ref);
      if (!target) continue;
      joined.join(target, e.key);
      threadedByChain.add(e.m.id);
    }
  }

  /* A reply that quotes nothing we can recognise, which is every reply to a
     message sent before its Message-ID was recorded, and any whose headers
     were stripped on the way. All that is left is the subject, so it is used
     only where it cannot be wrong: the message says it is a reply, and
     exactly one conversation we have written into carries that subject. A
     campaign's copy goes to dozens of people under one subject, so a reply
     from an address we do not know matches all of them, and matching many is
     not a match. */
  const written = new Map<string, Set<string>>();
  for (const e of entries) {
    if (e.m.dir !== "out") continue;
    const subj = normaliseSubject(e.m.subject);
    if (!subj) continue;
    (written.get(subj) ?? written.set(subj, new Set()).get(subj)!).add(joined.root(e.key));
  }
  for (const e of entries) {
    if (e.m.dir !== "in" || threadedByChain.has(e.m.id) || !answers(e.m.subject)) continue;
    const candidates = written.get(normaliseSubject(e.m.subject));
    if (candidates?.size !== 1) continue;
    joined.join([...candidates][0]!, e.key);
  }

  const byRoot = new Map<string, Entry[]>();
  for (const e of entries) {
    const root = joined.root(e.key);
    (byRoot.get(root) ?? byRoot.set(root, []).get(root)!).push(e);
  }

  const out: Thread[] = [];
  for (const es of byRoot.values()) {
    es.sort((a, b) => a.m.sort_at.localeCompare(b.m.sort_at));
    const messages = es.map((e) => e.m);
    /* The key the read state is stored under, and it has to be one of the
       merged keys rather than a new name: the oldest message's, which in the
       ordinary case is the one we wrote and the key the thread already had,
       so merging a reply in does not make the conversation look unread. */
    const key = es[0]!.key;
    const contactId = es.find((e) => e.contact_id)?.contact_id ?? null;
    const c = contactId ? contacts.find((x) => x.id === contactId) : undefined;
    /* The address to show, which is the one we write to when we have written
       — not the alias a reply happened to come from. */
    const addr = (es.find((e) => e.m.dir === "out") ?? es[0]!).addr;
    const human = messages.filter((m) => m.dir === "in" && !m.automated);
    /* A cancelled message never happened, so it cannot be what makes a
       thread recent — that is what pushed a dead draft above real mail. */
    const live = messages.filter((m) => m.status !== "canceled");
    out.push({
      key,
      /* The same thread for URLs: the id of its first email. Sorted just
         above, and a thread only exists once it has a message. */
      id: messages[0]!.id,
      contact_id: contactId,
      full_name: c?.full_name ?? addr ?? key,
      title: c?.title ?? "",
      company: c?.company ?? null,
      account_id: c?.account_id ?? null,
      email: c?.email ?? addr ?? null,
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

export async function threads(): Promise<Thread[]> {
  const [sends, replies, contacts] = await Promise.all([allSends(), allReplies(), crm.contacts()]);
  return group(sends, replies, contacts);
}
