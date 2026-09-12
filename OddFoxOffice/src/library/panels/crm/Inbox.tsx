import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Chip, H1, Note } from "../../../ui";
import {
  cancelSend, deleteDraft, markThreads, putDraft, sendDirect, sendNow, useCampaigns,
  useDrafts, useOutreachConfig, useOutreachStatus, useThreads,
  type MailDraft, type Thread, type ThreadMessage,
} from "../../../lib/outreachStore";
import { EmailBody } from "./EmailBody";
import { CampaignTag } from "./CampaignChip";
import { SequenceLink, SequenceModal } from "./SequenceModal";
import { CRM_CHANGED } from "./Operator";
import { useFocus } from "../../../lib/pageFocus";
import { RecipientField } from "./RecipientField";
import { RichEditor } from "./RichEditor";
import {
  isEmail, mergeRecipients, recipientFor, splitAddresses, type Recipient,
} from "./recipients";
import { Toast } from "./Toast";
import { SEND_TONE, useContacts } from "./shared";

/* The inbox. One conversation per person: what we sent, what came back.

   Laid out like a mail client because that is what it is, and because the
   question it answers — what have we actually said to this person — is one
   you answer by reading down a thread, not by cross-referencing two tables.
   Older messages collapse to a single line; the newest is open, since that is
   the one you are replying to. */

const fmt = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString([], sameYear
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric" });
};

/** First line of real text, for the list preview. */
const snippet = (m: ThreadMessage | undefined): string => {
  if (!m) return "";
  // Drop our own appended footer. There is no "--" marker any more, so cut at
  // the opt-out line, which the server always emits last and which no
  // hand-written message contains. Two wordings, because a message carries a
  // link when one can be minted and the reply instruction when it cannot —
  // see FOOTER_START in the server's render.ts, which this mirrors.
  const body = (m.body ?? "")
    .split(/\n+(?=Don't want these\? Unsubscribe:|Reply "unsubscribe")/)[0] ?? "";
  return body.replace(/\s+/g, " ").trim().slice(0, 120);
};

/** What the toast says once a message is on its way. */
const sentNote = (at: string, dry: boolean, people: number): string => {
  const who = people > 1 ? ` to ${people} people` : "";
  return dry
    ? `Queued${who} as a dry run for ${fmt(at)} — nothing was sent.`
    : `Sent${who}.`;
};

/** "to A, B · cc C · bcc D", for a message that went to a group. */
const rcptLine = (m: ThreadMessage): string => [
  `to ${[m.to, ...(m.also_to ?? [])].filter(Boolean).join(", ")}`,
  m.cc?.length ? `cc ${m.cc.join(", ")}` : null,
  m.bcc?.length ? `bcc ${m.bcc.join(", ")}` : null,
].filter(Boolean).join(" · ");

/** Grow and shrink, in the two corners Gmail uses, so they read at a glance. */
const SizeIcon = ({ full }: { full: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
       strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={full ? "M11 1 7 5M7 2v3h3M1 11l4-4M5 10V7H2" : "M7 5l4-4M8 1h3v3M5 7l-4 4M1 8v3h3"} />
  </svg>
);

function Message({ m, open, onToggle, onCancel, onNow, onSequence, busy }: {
  m: ThreadMessage; open: boolean; onToggle: () => void;
  onCancel: (id: string) => void; onNow: (id: string) => void;
  onSequence?: () => void; busy: boolean;
}) {
  const pullable = m.dir === "out" && (m.status === "scheduled" || m.status === "draft");
  return (
    <article className={`of-msg is-${m.dir}${open ? " is-open" : ""}${m.unread ? " is-unread" : ""}`}>
      <header className="of-msg__h" onClick={onToggle} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
        <span className="of-msg__who">{m.dir === "out" ? "Seaworth" : "them"}</span>
        {!open && <span className="of-msg__peek">{snippet(m)}</span>}
        {/* A message somebody typed needs no label — that is the default.
            Only sequence mail is worth marking, and then it should say what
            it came from and let you go read it. */}
        {m.dir === "out" && m.round ? (
          <span className="of-msg__tag of-msg__seq"
                title={`Automated — round ${m.round} of the sequence`}
                onClick={(e) => e.stopPropagation()}>
            <SequenceLink tier={m.template_tier ?? 1} round={m.round} />
          </span>
        ) : null}
        {m.dir === "out" && m.round && onSequence ? (
          <button className="of-msg__tag of-msg__tag--btn"
                  onClick={(e) => { e.stopPropagation(); onSequence(); }}
                  title="See this person's whole sequence">sequence</button>
        ) : null}
        {m.dry_run ? <Chip tone="warm">dry run</Chip> : null}
        {m.status && !m.dry_run
          ? <Chip tone={SEND_TONE[m.status] ?? ""}>{m.status}</Chip> : null}
        {m.unsubscribe ? <Chip tone="hot">opted out</Chip> : null}
        {m.automated ? <Chip tone="warm">auto</Chip> : null}
        <span className="of-msg__at">{fmt(m.at)}</span>
      </header>
      {open && (
        <div className="of-msg__open">
          {m.subject && <div className="of-msg__subj">{m.subject}</div>}
          {m.dir === "out" && (m.also_to?.length || m.cc?.length || m.bcc?.length) ? (
            <div className="of-msg__rcpt">{rcptLine(m)}</div>
          ) : null}
          <EmailBody html={m.html} text={m.body} />
          {pullable && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {/* Brings it forward rather than sending outright: it goes a
                  minute from now, which keeps cancel working. */}
              <button className="of-facet__b" disabled={busy} onClick={() => onNow(m.id)}>
                send now
              </button>
              <button className="of-dock__x" disabled={busy} onClick={() => onCancel(m.id)}>
                cancel this message
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** What is being written, and in which frame. A new message starts docked in
    the corner and a reply starts inline under its thread; either can be
    blown up to a full window and shrunk back without losing a word.

    `id` is the saved draft this composer is editing — there is always one,
    from the moment the composer opens — and `reply_to` is the conversation it
    answers, or null for a new message. */
type Draft = { id: string; reply_to: string | null; full: boolean };

/** How long typing has to stop before the draft is written. Long enough that
    a sentence is one save rather than forty, short enough that nothing
    plausible — a closed tab, a reload — lands inside it. */
const SAVE_MS = 900;

/** First line of a draft, for its row in the list. */
const draftPeek = (d: MailDraft): string =>
  d.body.replace(/\s+/g, " ").trim().slice(0, 120);

export function CrmInbox() {
  const { data, error, busy, reload } = useThreads();
  const threads = useMemo(() => data?.threads ?? [], [data]);
  /* The open conversation lives in the URL, as ?thread=<id>, the way Gmail
     keeps it in its address: a reload lands on the same email, back closes
     it, and a link — the bell's, or one pasted to a colleague — opens it.
     Pushed rather than replaced, so back steps through what you read.

     The thread's opaque id, never its key: the key is somebody's address and
     a subject line, and a URL ends up in chats and screenshots. */
  const [params, setParams] = useSearchParams();
  const openId = params.get("thread");
  /* Which folder the list is showing. In the URL for the same reason the
     open conversation is: Drafts is a place you go back to. */
  const onDrafts = params.get("view") === "drafts";
  /* Both in one update. Two setParams calls in a row would each start from
     the same current address and the second would undo the first. */
  const go = (next: { thread?: string | null; drafts?: boolean }, replace = false) =>
    setParams((p) => {
      const q = new URLSearchParams(p);
      if (next.thread !== undefined) {
        if (next.thread) q.set("thread", next.thread); else q.delete("thread");
      }
      if (next.drafts !== undefined) {
        if (next.drafts) q.set("view", "drafts"); else q.delete("view");
      }
      return q;
    }, { replace });
  const setOpenId = (id: string | null, replace = false) => go({ thread: id }, replace);
  const showDrafts = (yes: boolean) => go({ drafts: yes });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  /** The same body as formatted HTML, from the editor. `body` is its plain
      text, which is what decides whether there is anything to send. */
  const [html, setHtml] = useState("");
  const [working, setWorking] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [seqFor, setSeqFor] = useState<Thread | null>(null);
  const campaigns = useCampaigns();
  const [to, setTo] = useState<Recipient[]>([]);
  const [find, setFind] = useState("");
  const [cc, setCc] = useState<Recipient[]>([]);
  const [findCc, setFindCc] = useState("");
  const [bcc, setBcc] = useState<Recipient[]>([]);
  const [findBcc, setFindBcc] = useState("");
  // Cc and Bcc stay out of the way until asked for, as in Gmail.
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const { rows: contacts } = useContacts();
  const status = useOutreachStatus();
  const senders = useMemo(() => status.data?.senders ?? [], [status.data]);
  const [fromDomain, setFromDomain] = useState<string>("");
  const conf = useOutreachConfig();
  const signatures = useMemo(() => conf.data?.signatures ?? [], [conf.data]);
  const [signature, setSignature] = useState<string>("");
  /* Read state as the server last reported it, with whatever this tab has
     marked since laid over the top, so a click shows at once rather than at
     the next poll. An entry goes once the server has caught up. */
  const [marked, setMarked] = useState<Map<string, boolean>>(new Map());
  const [onlyUnread, setOnlyUnread] = useState(false);
  /* Everything this person has part way through writing. On the server, so a
     draft survives a reload and follows them to another machine. */
  const drafts = useDrafts();
  const saved = useMemo(() => drafts.data?.records ?? [], [drafts.data]);
  const replyDraftFor = (threadId: string | null): MailDraft | null =>
    (threadId ? saved.find((d) => d.reply_to === threadId) : null) ?? null;
  /** Drafts this tab has thrown away or sent. The list they were in takes a
      moment to catch up, and without this the effect that reopens a saved
      reply would put a discarded one straight back on the screen. */
  const gone = useRef<Set<string>>(new Set());

  /* Who it goes to, field by field: the chips, plus any finished address
     still sitting in the box — somebody who types an address and goes
     straight to Send means it. Somebody already on To is dropped from Cc,
     and from Bcc if on either, as mail clients do: nobody gets it twice. */
  const typed = (chips: Recipient[], text: string) => mergeRecipients(
    chips, splitAddresses(text).filter(isEmail).map((e) => recipientFor(e, contacts)));
  const toList = typed(to, find);
  const onEarlier = new Set(toList.map((r) => r.email.toLowerCase()));
  const ccList = typed(cc, findCc).filter((r) => !onEarlier.has(r.email.toLowerCase()));
  for (const r of ccList) onEarlier.add(r.email.toLowerCase());
  const bccList = typed(bcc, findBcc).filter((r) => !onEarlier.has(r.email.toLowerCase()));
  const everyone = [...toList, ...ccList, ...bccList];
  const bad = everyone.filter((r) => !isEmail(r.email));
  const ccOpen = showCc || cc.length > 0 || findCc !== "";
  const bccOpen = showBcc || bcc.length > 0 || findBcc !== "";

  /** The message as it now stands, in the shape the server keeps it in. */
  const composed = {
    to: toList.map((r) => r.email), cc: ccList.map((r) => r.email),
    bcc: bccList.map((r) => r.email), subject, body, html: html || null,
    from_domain: fromDomain || null, signature: signature || null,
  };
  type Composed = typeof composed;
  /** The same, as one string: what the autosave watches, and what tells a
      draft nobody has typed into from one somebody has. */
  const shapeOf = (c: Composed) => JSON.stringify([
    c.to, c.cc, c.bcc, c.subject, c.body, c.html, c.from_domain, c.signature]);
  const shape = shapeOf(composed);
  /** A draft created by the click that opened the composer, and its text at
      that moment. Reopening a saved draft clears it — only a brand new one
      can be thrown away for being blank. */
  const opened = useRef<{ id: string; shape: string } | null>(null);
  const disposable = Boolean(draft && opened.current?.id === draft.id
                             && opened.current.shape === shape);
  /** What the server was last told, so opening a draft and reading it does
      not write it straight back — which would reorder the list and move its
      saved time for a message nobody has touched. */
  const written = useRef<string>("");
  const stamp = (id: string, c: Composed) => `${id}:${shapeOf(c)}`;

  // Default to an outreach domain, never the personal one — picking that has
  // to be a deliberate choice, not what happens if you do not look.
  useEffect(() => {
    if (!fromDomain && senders.length) {
      setFromDomain((senders.find((x) => !x.manual_only) ?? senders[0]!).domain);
    }
  }, [senders, fromDomain]);

  useEffect(() => {
    const r = () => void reload();
    window.addEventListener(CRM_CHANGED, r);
    return () => window.removeEventListener(CRM_CHANGED, r);
  }, [reload]);

  /** A reply, written under the conversation it answers. */
  const replying = Boolean(draft?.reply_to);
  /** A new message, in the docked window. */
  const composing = Boolean(draft && !draft.reply_to);

  // Escape shrinks the full window back to where it came from. It never
  // discards: a draft is too easy to lose to a reflex.
  const full = draft?.full ?? false;
  useEffect(() => {
    if (!full) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDraft((d) => d && { ...d, full: false });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [full]);

  const isUnread = (t: Thread) => (marked.has(t.key) ? !marked.get(t.key) : t.unread > 0);
  const unreadCount = threads.filter(isUnread).length;
  // The thread you are reading stays in the Unread view after it is read, as
  // it does in Gmail — vanishing from under the cursor is disorienting.
  const shown = onlyUnread ? threads.filter((t) => isUnread(t) || t.id === openId) : threads;

  /* Nothing is open until you open it. Showing the newest thread by default
     is what Gmail's reading pane declines to do, and for the same reason:
     opening is reading, so an inbox that opened its top thread on load would
     mark your newest mail read before you had looked at it. */
  const open: Thread | null = threads.find((t) => t.id === openId) ?? null;
  const last = open?.messages[open.messages.length - 1];

  /* What the agent in the dock is told this page is showing: the open
     thread, by key, and anything being written. The draft goes whole rather
     than as an id — it is saved, but the agent has no way to read it back,
     and what matters is the words on the screen this second. */
  useFocus({
    label: [open && `${open.full_name}${last?.subject ? ` — ${last.subject}` : ""}`,
            draft && (replying ? "your reply" : "new email")]
      .filter(Boolean).join(" › ") || undefined,
    thread: open?.key,
    draft: draft ? {
      reply: replying,
      to: toList.map((r) => r.email), cc: ccList.map((r) => r.email),
      bcc: bccList.map((r) => r.email), subject, body: body.slice(0, 8000),
    } : undefined,
    view: onDrafts ? "the drafts folder"
      : onlyUnread ? "only unread conversations" : undefined,
  });

  /* The mail client fills what is left of the window and scrolls inside
     itself. Letting the page scroll instead moves the list and the thread
     together, which is exactly what you do not want when reading one thread
     against the list. Measured rather than guessed, because what sits above
     the inbox — the header, the tabs, a notice — changes height. */
  const box = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      // Take the room under the inbox, then give back whatever that made the
      // page overflow by. Measuring the correction beats predicting it: what
      // sits below — page padding, the footer — is not this panel's business.
      const top = el.getBoundingClientRect().top;
      const h = Math.max(320, window.innerHeight - top);
      el.style.height = `${h}px`;
      const over = document.documentElement.scrollHeight - window.innerHeight;
      if (over > 0) el.style.height = `${Math.max(320, h - over)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  });

  const clearPeople = (ccPeople: Recipient[] = []) => {
    setFind(""); setCc(ccPeople); setFindCc(""); setBcc([]); setFindBcc("");
    setShowCc(ccPeople.length > 0); setShowBcc(false);
  };

  /* Saving what is being written. Every composer here edits a draft that
     already exists on the server — one is created the moment you click New
     email or Reply — so there is no "unsaved" state to lose, and Drafts can
     list a message you have not typed a word into yet.

     Writes are serialised through `writing` so that discarding cannot race a
     save that is already in flight and resurrect the draft it just deleted. */
  const writing = useRef<Promise<unknown>>(Promise.resolve());
  const write = (d: MailDraft) => {
    written.current = stamp(d.id, d);
    writing.current = writing.current
      .then(() => putDraft(d))
      .then(() => drafts.reload())
      // A failed save is not worth a toast over a half-written sentence: the
      // next keystroke tries again, and the words are still on the screen.
      .catch(() => {});
    return writing.current;
  };

  const blank = (id: string, replyTo: string | null): MailDraft => ({
    id, reply_to: replyTo, to: [], cc: [], bcc: [], subject: "", body: "", html: null,
    from_domain: fromDomain || null, signature: signature || null,
    created_at: "", updated_at: "",
  });

  /** Puts a saved draft back on the screen, chips and all. */
  const loadDraft = (d: MailDraft) => {
    setTo(d.to.map((e) => recipientFor(e, contacts)));
    setCc(d.cc.map((e) => recipientFor(e, contacts)));
    setBcc(d.bcc.map((e) => recipientFor(e, contacts)));
    setFind(""); setFindCc(""); setFindBcc("");
    setShowCc(d.cc.length > 0); setShowBcc(d.bcc.length > 0);
    setSubject(d.subject); setBody(d.body); setHtml(d.html ?? "");
    if (d.from_domain) setFromDomain(d.from_domain);
    if (d.signature) setSignature(d.signature);
    opened.current = null;
    written.current = stamp(d.id, d);
    setDraft({ id: d.id, reply_to: d.reply_to, full: false });
  };

  const startCompose = () => {
    const d = blank(crypto.randomUUID(), null);
    setTo([]); clearPeople(); setSubject(""); setBody(""); setHtml("");
    opened.current = { id: d.id, shape: shapeOf(d) };
    setDraft({ id: d.id, reply_to: null, full: false });
    void write(d);
  };

  /* The last message we sent this thread that had other people on it —
     what Reply all answers. */
  const lastGroup = [...(open?.messages ?? [])].reverse()
    .find((m) => m.dir === "out" && (m.also_to?.length || m.cc?.length));

  /* Reply goes to the person whose thread it is. Reply all puts everyone
     else from our last group message back on Cc, the way Gmail's reply all
     does. Bcc never carries over: that is what Bcc means.

     A reply you had already started comes back instead: one draft per
     conversation, so Reply never quietly abandons what you wrote. */
  const startReply = (all: boolean) => {
    if (!open) return;
    const already = replyDraftFor(open.id);
    if (already) { loadDraft(already); return; }
    const s = last?.subject ?? "";
    const subj = s.toLowerCase().startsWith("re:") ? s : s ? `Re: ${s}` : "";
    const lead = open.email
      ? [{ email: open.email, contact_id: open.contact_id, name: open.full_name }] : [];
    const others = all && lastGroup
      ? [...(lastGroup.also_to ?? []), ...(lastGroup.cc ?? [])]
          .filter((e) => e.toLowerCase() !== open.email?.toLowerCase())
          .map((e) => recipientFor(e, contacts))
      : [];
    setSubject(subj); setBody(""); setHtml(""); setTo(lead); clearPeople(others);
    const d = { ...blank(crypto.randomUUID(), open.id), subject: subj,
                to: lead.map((r) => r.email), cc: others.map((r) => r.email) };
    opened.current = { id: d.id, shape: shapeOf(d) };
    setDraft({ id: d.id, reply_to: open.id, full: false });
    void write(d);
  };

  /** Throws the draft away and clears the composer. On a reply this is the
      reset button: the conversation keeps no half-written answer. */
  const discard = () => {
    const d = draft;
    if (!d) return;
    gone.current.add(d.id);
    setDraft(null);
    setTo([]); clearPeople(); setSubject(""); setBody(""); setHtml("");
    // After whatever save is in flight, or the delete races it and loses.
    writing.current = writing.current
      .then(() => deleteDraft(d.id))
      .then(() => drafts.reload())
      .catch((e) => setSaid(e instanceof Error ? e.message : String(e)));
  };

  /** Puts the composer away and leaves the draft where it is — except one
      created by the click that opened it and never typed into, which goes
      with it. Gmail does the same, and a Drafts list filling up with blank
      rows from stray clicks helps nobody. */
  const leave = () => { if (disposable) discard(); else setDraft(null); };

  const resize = () => setDraft((d) => d && { ...d, full: !d.full });

  const doCancel = async (id: string) => {
    setWorking(true);
    try { setSaid((await cancelSend(id)).note); await reload(); }
    catch (e) { setSaid(e instanceof Error ? e.message : String(e)); }
    finally { setWorking(false); }
  };

  /* Brings a queued message forward. Same shape as cancel — one call, one
     toast — because from here they are the two halves of the same decision:
     this one is wrong and should stop, or this one is right and should not
     wait for the window. */
  const doNow = async (id: string) => {
    setWorking(true);
    try {
      const r = await sendNow(id);
      setSaid(r?.note ?? "on its way");
      await reload();
    } catch (e) { setSaid(e instanceof Error ? e.message : String(e)); }
    finally { setWorking(false); }
  };

  const doSend = async () => {
    const lead = toList[0];
    if (!draft || !lead || bad.length || !subject.trim() || !body.trim()) return;
    /* Quote the conversation so the reply threads instead of arriving as a
       new message. In-Reply-To points at the last message that has an id;
       References carries the whole chain, which is what keeps long threads
       from splitting. */
    const chain = (draft.reply_to ? open?.messages ?? [] : [])
      .map((m) => m.message_id)
      .filter((x): x is string => Boolean(x));

    setWorking(true);
    try {
      /* One message, whoever is on it. The first person on To is who the
         conversation is filed under — the thread, the history, their
         contact record — and everyone else is on the same message, so a
         reply all from any of them reaches the whole group. If the server
         refuses it, nothing went, and the draft stays as it was to fix. */
      const res = await sendDirect(
        lead.contact_id ? { contact_id: lead.contact_id, to: null } : { contact_id: null, to: lead.email },
        subject.trim(), body.trim(), fromDomain || null, signature || null,
        { in_reply_to: chain[chain.length - 1] ?? null, references: chain },
        { also_to: toList.slice(1).map((r) => r.email),
          cc: ccList.map((r) => r.email), bcc: bccList.map((r) => r.email) },
        html || null);
      setSaid(sentNote(res.scheduled_at, res.dry_run, everyone.length));
      /* The message exists now, so the draft it was written in should not.
         Behind whatever save is in flight, so a keystroke from a second ago
         cannot put it back. */
      gone.current.add(draft.id);
      writing.current = writing.current
        .then(() => deleteDraft(draft.id)).then(() => drafts.reload()).catch(() => {});
      setDraft(null); setTo([]); clearPeople(); setSubject(""); setBody(""); setHtml("");
      await reload();
    } catch (e) { setSaid(e instanceof Error ? e.message : String(e)); }
    finally { setWorking(false); }
  };

  /** How far opening a thread has read: its newest incoming message. */
  const latestIn = (t: Thread): string | null => t.messages.reduce<string | null>(
    (acc, m) => (m.dir === "in" && (!acc || m.sort_at > acc) ? m.sort_at : acc), null);

  const mark = async (ts: Thread[], read: boolean) => {
    const marks = ts.map((t) => ({ key: t.key, through: read ? latestIn(t) : null }))
      .filter((x) => !read || x.through);
    if (!marks.length) return;
    setMarked((prev) => {
      const next = new Map(prev);
      for (const x of marks) next.set(x.key, read);
      return next;
    });
    try {
      await markThreads(marks);
      await reload();
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally {
      // The server's answer wins either way: on success it now agrees, and
      // on failure the override would be showing something that is not so.
      setMarked((prev) => {
        const next = new Map(prev);
        for (const x of marks) next.delete(x.key);
        return next;
      });
    }
  };

  /* Mail that arrives while a thread is open is read too — you are looking
     at it. Only while the tab is in front, though: a thread left open in a
     background tab has been read by nobody. Mark as unread closes the thread
     for the same reason this exists: left open, it would be read straight
     back. */
  const openUnread = open ? isUnread(open) : false;
  useEffect(() => {
    if (open && openUnread && document.visibilityState === "visible") void mark([open], true);
  });

  /** The thread whose messages were last unfolded, so arriving by URL does
      not unfold one a click already has. */
  const unfolded = useRef<string | null>(null);

  /* The composer, written a moment after typing stops. A draft exists from
     the first click, so this only ever updates one, and the cleanup clears
     the timer when the composer closes — a discard can never be followed by
     a save of what was discarded. */
  useEffect(() => {
    if (!draft || written.current === `${draft.id}:${shape}`) return;
    const { id, reply_to } = draft;
    const now = { ...composed };
    const t = window.setTimeout(() => {
      void write({ id, reply_to, ...now, created_at: "", updated_at: "" });
    }, SAVE_MS);
    return () => window.clearTimeout(t);
    // The draft and its text are what decide whether there is anything to
    // save; `composed` and `write` are new objects on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draft?.reply_to, shape]);

  /* Opening a conversation you had started answering puts the reply back
     under it, the way Gmail reopens a draft in its thread — but not over
     something else being written, and not one this tab has just thrown
     away or sent. */
  useEffect(() => {
    if (!openId || draft) return;
    const d = replyDraftFor(openId);
    if (!d || gone.current.has(d.id)) return;
    loadDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, saved, draft]);

  /** Show what is new, the way Gmail unfolds the unread messages and the
      last one and leaves the rest folded. Read threads open as before. */
  const unfold = (t: Thread) => {
    const fresh = isUnread(t) ? t.messages.filter((m) => m.unread).map((m) => `${m.dir}-${m.id}`) : [];
    const end = t.messages[t.messages.length - 1];
    setExpanded(fresh.length && end ? new Set([...fresh, `${end.dir}-${end.id}`]) : new Set());
    // A reply belongs under the thread it was started in. Closing it here
    // loses nothing — it is saved, and opening that thread brings it back.
    if (draft?.reply_to && draft.reply_to !== t.id) leave();
    unfolded.current = t.id;
  };

  const openThread = (t: Thread) => {
    // Already open: a second history entry for it would make back look broken.
    if (t.id === openId) return;
    setOpenId(t.id);
    unfold(t);
    // A click is proof somebody is looking, whatever the tab reports, so
    // opening marks it here rather than waiting on the effect above.
    if (isUnread(t)) void mark([t], true);
  };

  /** Picking one out of the Drafts list. A reply goes back under the
      conversation it answers, which means leaving the folder to show it; a
      new message opens in the docked window, over whichever list you were
      looking at. */
  const openSaved = (d: MailDraft) => {
    const t = d.reply_to ? threads.find((x) => x.id === d.reply_to) ?? null : null;
    if (d.reply_to && !t) {
      // The conversation it answered is not in the list — nothing to put it
      // under. Rare enough to explain rather than silently do nothing.
      setSaid("The conversation this reply belongs to is no longer here.");
      return;
    }
    if (t) { go({ thread: t.id, drafts: false }); unfold(t); }
    loadDraft(d);
  };

  /* Arriving on a thread by its URL — a reload, the bell, back and forward —
     unfolds it the way a click does, once the threads are in, which is when
     the id means anything. Marking it read is left to the effect above, so
     a tab restored in the background does not read your mail for you. An id
     that matches nothing, from an old link, is dropped rather than left in
     the address claiming something is open. */
  useEffect(() => {
    if (!openId || !data || unfolded.current === openId) return;
    const t = threads.find((x) => x.id === openId);
    if (t) unfold(t);
    else setOpenId(null, true);
    // unfold and setOpenId are new on every render; the id and the data are
    // what decide whether there is anything to do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, data]);

  const markUnread = (t: Thread) => { setOpenId(null); void mark([t], false); };

  // Gmail's "(3)" in the browser tab, so new mail shows from another tab too.
  useEffect(() => {
    const base = document.title;
    if (unreadCount > 0) document.title = `(${unreadCount}) ${base}`;
    return () => { document.title = base; };
  }, [unreadCount]);

  if (error) {
    return <><H1>Inbox</H1><Note><strong>The CRM server is not answering. </strong>{error}</Note></>;
  }

  /* One set of fields, three frames. New email is a popup you can move away
     from; a reply belongs at the bottom of the thread it answers, where you
     can still read what you are replying to; and either can take the whole
     window when the message is long enough to want it. */
  const fields = (
    <>
      <label className="of-cw__row">
        <span className="of-cw__k">From</span>
        <select className="of-sel of-cw__v" value={fromDomain} disabled={working}
                onChange={(e) => setFromDomain(e.target.value)}>
          {senders.map((x) => (
            <option key={x.domain} value={x.domain}>
              {x.address}{x.manual_only ? "  (personal — by hand only)" : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="of-cw__row of-cw__row--top">
        <span className="of-cw__k">To</span>
        <div className="of-cw__v">
          <RecipientField value={to} onChange={setTo} text={find} onText={setFind}
                          people={contacts} disabled={working} />
        </div>
        {(!ccOpen || !bccOpen) && (
          <span className="of-cw__cc">
            {!ccOpen && <button type="button" disabled={working} onClick={() => setShowCc(true)}>Cc</button>}
            {!bccOpen && <button type="button" disabled={working} onClick={() => setShowBcc(true)}>Bcc</button>}
          </span>
        )}
      </div>
      {ccOpen && (
        <div className="of-cw__row of-cw__row--top">
          <span className="of-cw__k">Cc</span>
          <div className="of-cw__v">
            <RecipientField value={cc} onChange={setCc} text={findCc} onText={setFindCc}
                            people={contacts} disabled={working} />
          </div>
        </div>
      )}
      {bccOpen && (
        <div className="of-cw__row of-cw__row--top">
          <span className="of-cw__k">Bcc</span>
          <div className="of-cw__v">
            <RecipientField value={bcc} onChange={setBcc} text={findBcc} onText={setFindBcc}
                            people={contacts} disabled={working} />
          </div>
        </div>
      )}

      <input className="of-chat__in" placeholder="Subject" value={subject}
             disabled={working} onChange={(e) => setSubject(e.target.value)} />
      {/* Keyed by the draft, so opening a saved one loads its text: the
          editor keeps its own document and is built from `html` at mount. */}
      <RichEditor key={draft?.id ?? "none"} className="of-cw__body"
                  style={full ? undefined : { minHeight: composing ? 240 : 190 }}
                  html={html} disabled={working} placeholder="Write a message…"
                  onChange={(h, t) => { setHtml(h); setBody(t); }} />

      {/* Below the body, where it reads in the order the message does: you
          write, then you choose how to sign off. */}
      {signatures.length > 0 && (
        <label className="of-cw__row">
          <span className="of-cw__k">Sign</span>
          <select className="of-sel of-cw__v"
                  value={signature || conf.data?.default_signature || ""}
                  disabled={working} onChange={(e) => setSignature(e.target.value)}>
            {signatures.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}{x.id === conf.data?.default_signature ? " (default)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );

  /* What the composer says about itself. Gmail's "Saved" line, and it is
     worth saying: a composer that saves silently looks exactly like one that
     does not save at all. */
  const savedAt = draft ? saved.find((d) => d.id === draft.id)?.updated_at ?? null : null;
  const savedNote = savedAt ? `Draft saved ${fmt(savedAt)}` : "Saving draft…";

  const actions = (() => {
    // Say why the button is dead rather than leaving it greyed and
    // unexplained — "no recipient picked" is not obvious when the search box
    // already has text in it.
    const missing = !toList.length
      ? (ccList.length || bccList.length
          ? "add someone to To — Cc and Bcc go alongside them"
          : "pick someone from the list, or type or paste email addresses")
      : bad.length
        ? `${bad.length === 1 ? "one address isn't" : `${bad.length} addresses aren't`} valid — click to fix, or × to drop`
      : !subject.trim() ? "add a subject"
      : !body.trim() ? "write a message"
      : null;
    const n = everyone.length;
    return (
      <>
        <button className="of-facet__b" onClick={() => void doSend()}
                disabled={working || Boolean(missing)}>
          {working ? "…" : "Send"}
        </button>
        {/* The composer has nothing to save — the draft is saved as you type
            — so the only other button is the one that throws it away. On a
            reply that is the reset: the conversation stops holding an
            unfinished answer. */}
        <button className="of-dock__x" disabled={working} onClick={discard}
                title={replying ? "Delete this reply draft and start over"
                  : "Delete this draft"}>
          {replying ? "reset reply" : "discard draft"}
        </button>
        <span className="of-note">
          {missing ?? (n > 1
            ? `One message to ${n} people${bccList.length ? `, ${bccList.length} of them on Bcc` : ""}. Signature added for you.`
            : "Signature added for you.")}
        </span>
        <span className="of-note of-cw__saved">{savedNote}</span>
      </>
    );
  })();

  const title = replying ? `Reply to ${open?.full_name ?? "them"}` : "New message";
  const tools = (
    <span className="of-cw__tools">
      <button className="of-cw__x" onClick={resize}
              title={full ? "Shrink back" : "Open full size"}
              aria-label={full ? "Shrink back" : "Open full size"}>
        <SizeIcon full={full} />
      </button>
      {/* Closes the window and leaves the draft where it is. Throwing it
          away is the button in the footer, which says so. */}
      <button className="of-cw__x" onClick={leave} disabled={working}
              title="Close — the draft is saved" aria-label="Close">×</button>
    </span>
  );

  /* The full-size window, for either kind. A click on the backdrop shrinks
     it rather than closing it, for the same reason Escape does. Mouse-down
     rather than click, so a text selection dragged out of the box and let go
     over the backdrop does not count. */
  const composer = !draft ? null : full ? (
    <div className="of-modal" role="dialog" aria-modal="true" aria-label={title}
         onMouseDown={(e) => { if (e.target === e.currentTarget) resize(); }}>
      <div className="of-modal__box of-cwfull">
        <header className="of-cw__h"><span>{title}</span>{tools}</header>
        <div className="of-cw__b">{fields}</div>
        <footer className="of-cw__f">{actions}</footer>
      </div>
    </div>
  ) : composing ? (
    <div className="of-cw" role="dialog" aria-label="Compose">
      <header className="of-cw__h"><span>New message</span>{tools}</header>
      <div className="of-cw__b">{fields}</div>
      <footer className="of-cw__f">{actions}</footer>
    </div>
  ) : null;

  const counts = (
    <span className="of-inbox__counts">
      {unreadCount > 0 && (
        <><strong className="of-inbox__new">{unreadCount}</strong> unread
          <span className="of-inbox__sep">·</span></>
      )}
      <strong>{threads.length}</strong> conversation{threads.length === 1 ? "" : "s"}
      <span className="of-inbox__sep">·</span>
      <strong>{threads.reduce((n, t) => n + t.replies, 0)}</strong> replied
      <span className="of-inbox__sep">·</span>
      <strong>{threads.reduce((n, t) => n + t.sent, 0)}</strong> sent
    </span>
  );

  /* Inbox and Drafts are two folders over one list, Gmail's arrangement, and
     Unread is a filter inside the first. Drafts is a place rather than a
     filter — what is in it is not mail — so it takes the whole list and the
     unread controls go with it. */
  const filters = (
    <>
      <button className="of-facet__b" aria-pressed={!onDrafts && onlyUnread}
              onClick={() => { showDrafts(false); setOnlyUnread((x) => !x); }}
              title={onlyUnread ? "Show every conversation" : "Show only conversations with mail you have not opened"}>
        Unread
      </button>
      <button className="of-facet__b" aria-pressed={onDrafts}
              onClick={() => showDrafts(!onDrafts)}
              title={onDrafts ? "Back to the conversations"
                : "What you have started writing and not sent"}>
        Drafts{saved.length ? ` (${saved.length})` : ""}
      </button>
      {!onDrafts && unreadCount > 0 && (
        <button className="of-dock__x" onClick={() => void mark(threads.filter(isUnread), true)}>
          mark all read
        </button>
      )}
    </>
  );

  /* A draft's row. The person it is to, when it was last saved, and the
     first line — the same three things a conversation's row shows, because
     you are picking between them the same way. */
  const draftRows = (
    <>
      {saved.map((d) => (
        <button key={d.id}
                className={`of-inbox__row${draft?.id === d.id ? " is-on" : ""}`}
                onClick={() => openSaved(d)}>
          <span className="of-inbox__l1">
            <span className="of-inbox__who">
              {d.to[0] ?? "No recipient yet"}
              {d.to.length > 1 ? ` +${d.to.length - 1}` : ""}
            </span>
            <span className="of-inbox__at">{fmt(d.updated_at)}</span>
          </span>
          <span className="of-inbox__l2">
            <span className="of-inbox__subj">{d.subject || "(no subject)"}</span>
            <span className="of-inbox__peek"> — {draftPeek(d) || "nothing written yet"}</span>
          </span>
          <span className="of-inbox__l3">{d.reply_to ? "reply" : "new message"}</span>
        </button>
      ))}
      {saved.length === 0 && (
        <div className="of-inbox__none">
          {drafts.busy ? "Loading…" : "No drafts. Anything you start writing is kept here."}
        </div>
      )}
    </>
  );

  const newButton = (
    <button className="of-facet__b" onClick={startCompose} disabled={composing}>
      New email
    </button>
  );

  // A refusal list for thirty addresses takes longer than six seconds to read.
  const toast = <Toast message={said} onDone={() => setSaid(null)}
                       ms={Math.max(6000, (said?.length ?? 0) * 60)} />;

  if (threads.length === 0 && !onDrafts) {
    return (
      <>
        <div className="of-inbox__bar">{newButton}{filters}{counts}</div>
        <Note>{busy ? "Loading…" : "Nothing here yet. Write to someone and the conversation appears here."}</Note>
        {composer}
        {toast}
      </>
    );
  }

  return (
    <>
      <div className="of-inbox__bar">{newButton}{filters}{counts}</div>

      <div className="of-inbox" ref={box}>
        <nav className="of-inbox__list" aria-label={onDrafts ? "Drafts" : "Conversations"}>
          {onDrafts ? draftRows : shown.map((t) => {
            const preview = t.messages[t.messages.length - 1];
            return (
              <button key={t.key}
                      className={`of-inbox__row${open?.key === t.key ? " is-on" : ""}${isUnread(t) ? " is-unread" : ""}`}
                      onClick={() => openThread(t)}>
                <span className="of-inbox__l1">
                  <span className="of-inbox__who">{t.full_name}</span>
                  <span className="of-inbox__at">{fmt(t.last_at)}</span>
                </span>
                <span className="of-inbox__l2">
                  <span className="of-inbox__subj">{preview?.subject ?? "(no subject)"}</span>
                  <span className="of-inbox__peek"> — {snippet(preview)}</span>
                </span>
                {/* Which campaign this person is in, not how much they have
                    had. In a list of conversations "1 sent" is noise; the
                    campaign is the thing that groups them. */}
                <span className="of-inbox__l3">
                  {t.company ?? "—"}
                  {t.account_id && campaigns.data?.states[t.account_id] ? (
                    <> · <CampaignTag of={campaigns.data.states[t.account_id]} /></>
                  ) : null}
                  {t.replies ? ` · ${t.replies} in` : ""}
                </span>
              </button>
            );
          })}
          {!onDrafts && onlyUnread && shown.length === 0 && (
            <div className="of-inbox__none">Nothing unread.</div>
          )}
        </nav>

        <div className="of-inbox__thread">
          {open ? (
            <>
              <header className="of-inbox__head">
                <div className="of-inbox__tools">
                  <button className="of-dock__x" onClick={() => setOpenId(null)}
                          title="Close this conversation">close</button>
                  {open.messages.some((m) => m.dir === "in") && (
                    <button className="of-dock__x" onClick={() => markUnread(open)}
                            disabled={replying}
                            title={replying ? "Send or reset the reply first"
                              : "Mark as unread and close it"}>
                      mark as unread
                    </button>
                  )}
                </div>
                <div className="of-inbox__title">{last?.subject ?? open.full_name}</div>
                <div className="of-note">
                  {open.full_name} · {open.title || "role unknown"} · {open.company ?? "—"}
                  {" · "}{open.email ?? "no address on record"}
                </div>
              </header>

              {open.messages.map((m, i) => {
                const key = `${m.dir}-${m.id}`;
                const isLast = i === open.messages.length - 1;
                return (
                  <Message key={key} m={m} busy={working}
                           open={expanded.has(key) || (isLast && expanded.size === 0)}
                           onToggle={() => setExpanded((prev) => {
                             const next = new Set(prev);
                             // First click on a collapsed thread should open
                             // that one and close the implicitly-open last.
                             if (next.size === 0 && !isLast) { next.add(key); return next; }
                             if (next.has(key)) next.delete(key); else next.add(key);
                             return next;
                           })}
                           onCancel={(id) => void doCancel(id)}
                           onNow={(id) => void doNow(id)}
                           onSequence={() => setSeqFor(open)} />
                );
              })}

              {replying ? (
                // Popped out, the reply lives in the window; nothing here
                // should look like a second, empty copy of it.
                !full && (
                  <div className="of-reply">
                    <header className="of-reply__h">
                      <span>Reply</span>
                      <span className="of-cw__tools">
                        <button className="of-cw__x" onClick={resize}
                                title="Open in a full-size window"
                                aria-label="Open in a full-size window">
                          <SizeIcon full={false} />
                        </button>
                      </span>
                    </header>
                    <div className="of-cw__b">{fields}</div>
                    <div className="of-cw__f">{actions}</div>
                  </div>
                )
              ) : (
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button className="of-facet__b"
                          disabled={!open.email || composing} onClick={() => startReply(false)}
                          title={!open.email ? "No address on record"
                            : draft ? "Send or discard the new message first"
                            : "Write to this person"}>
                    Reply
                  </button>
                  {lastGroup && (
                    <button className="of-facet__b"
                            disabled={!open.email || composing} onClick={() => startReply(true)}
                            title={draft ? "Send or discard the new message first"
                              : "Reply to everyone who was on our last group message"}>
                      Reply all
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="of-inbox__empty">
              {unreadCount > 0
                ? <span><strong>{unreadCount}</strong> unread conversation{unreadCount === 1 ? "" : "s"}. Pick one to read it.</span>
                : <span>No conversation selected.</span>}
            </div>
          )}
        </div>
      </div>
      {composer}
      {seqFor ? <SequenceModal thread={seqFor} onClose={() => setSeqFor(null)} /> : null}
      {toast}
    </>
  );
}
