import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Chip, H1, Note } from "../../../ui";
import {
  cancelSend, markThreads, sendDirect, sendNow, useCampaigns, useOutreachConfig,
  useOutreachStatus, useThreads,
  type Thread, type ThreadMessage,
} from "../../../lib/outreachStore";
import { EmailBody } from "./EmailBody";
import { CampaignTag } from "./CampaignChip";
import { SequenceLink, SequenceModal } from "./SequenceModal";
import { CRM_CHANGED } from "./Operator";
import { RecipientField } from "./RecipientField";
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

type Sent = { r: Recipient; at: string; dry: boolean };
type Refused = { r: Recipient; why: string };

/** One toast for a whole batch. Every refusal is named with its reason — a
    full cap or an opt-out is normal, but you need to know who it was. */
const summarize = (done: Sent[], refused: Refused[]): string => {
  const d = done[0];
  if (d && done.length === 1 && !refused.length) {
    return d.dry
      ? `Queued as a dry run for ${fmt(d.at)} — nothing was sent.`
      : `Scheduled for ${fmt(d.at)}. Cancellable until it goes.`;
  }
  const parts: string[] = [];
  if (d) {
    const first = done.map((x) => x.at).sort()[0]!;
    parts.push(done.every((x) => x.dry)
      ? `Queued ${done.length} as a dry run from ${fmt(first)} — nothing was sent.`
      : `Scheduled ${done.length} messages, one per person, from ${fmt(first)}. Each is cancellable until it goes.`);
  }
  if (refused.length) {
    parts.push(`${refused.length === 1 ? "Not sent" : `${refused.length} not sent`}: `
      + refused.map((x) => `${x.r.name ?? x.r.email} — ${x.why}`).join("; "));
  }
  return parts.join(" ");
};

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
    blown up to a full window and shrunk back without losing a word. */
type Draft = { kind: "new" | "reply"; full: boolean };

export function CrmInbox() {
  const { data, error, busy, reload } = useThreads();
  const threads = useMemo(() => data?.threads ?? [], [data]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [seqFor, setSeqFor] = useState<Thread | null>(null);
  const campaigns = useCampaigns();
  const [to, setTo] = useState<Recipient[]>([]);
  const [find, setFind] = useState("");
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

  /* Who it goes to: the chips, plus any finished address still sitting in
     the box. Somebody who types an address and goes straight to Send means
     it, and a dead button that wants a comma first is not a mail client. */
  const recipients = useMemo(
    () => mergeRecipients(to, splitAddresses(find).filter(isEmail)
      .map((e) => recipientFor(e, contacts))),
    [to, find, contacts]);
  const bad = recipients.filter((r) => !isEmail(r.email));

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
  const shown = onlyUnread ? threads.filter((t) => isUnread(t) || t.key === openId) : threads;

  /* Nothing is open until you open it. Showing the newest thread by default
     is what Gmail's reading pane declines to do, and for the same reason:
     opening is reading, so an inbox that opened its top thread on load would
     mark your newest mail read before you had looked at it. */
  const open: Thread | null = threads.find((t) => t.key === openId) ?? null;
  const last = open?.messages[open.messages.length - 1];

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

  const startCompose = () => {
    setDraft({ kind: "new", full: false });
    setTo([]); setFind(""); setSubject(""); setBody("");
  };

  const startReply = () => {
    const s = last?.subject ?? "";
    setSubject(s.toLowerCase().startsWith("re:") ? s : s ? `Re: ${s}` : "");
    setBody(""); setFind("");
    setTo(open?.email
      ? [{ email: open.email, contact_id: open.contact_id, name: open.full_name }] : []);
    setDraft({ kind: "reply", full: false });
  };

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
    if (!draft || !recipients.length || bad.length || !subject.trim() || !body.trim()) return;
    /* Quote the conversation so the reply threads instead of arriving as a
       new message. In-Reply-To points at the last message that has an id;
       References carries the whole chain, which is what keeps long threads
       from splitting. Only the person whose thread it is gets the chain:
       anyone added alongside them never had those messages, and their copy
       would thread onto nothing. */
    const chain = (draft.kind === "reply" ? open?.messages ?? [] : [])
      .map((m) => m.message_id)
      .filter((x): x is string => Boolean(x));
    const ofThread = (r: Recipient) => draft.kind === "reply" && open !== null
      && (r.contact_id ? r.contact_id === open.contact_id
                       : r.email.toLowerCase() === open.email?.toLowerCase());

    setWorking(true);
    const done: Sent[] = [];
    const refused: Refused[] = [];
    try {
      /* One after another, not all at once: the server picks each message's
         slot by reading what is already queued, so parallel calls would all
         land on the same one. */
      for (const [i, r] of recipients.entries()) {
        if (recipients.length > 1) setProgress(`${i + 1}/${recipients.length}`);
        const mine = ofThread(r) ? chain : [];
        try {
          const res = await sendDirect(
            r.contact_id ? { contact_id: r.contact_id, to: null } : { contact_id: null, to: r.email },
            subject.trim(), body.trim(), fromDomain || null, signature || null,
            { in_reply_to: mine[mine.length - 1] ?? null, references: mine });
          done.push({ r, at: res.scheduled_at, dry: res.dry_run });
        } catch (e) {
          refused.push({ r, why: e instanceof Error ? e.message : String(e) });
        }
      }
      setSaid(summarize(done, refused));
      if (refused.length) {
        // Keep the draft, holding only who it did not reach, so whatever
        // needs fixing is right there and a second Send cannot double up.
        setTo(refused.map((x) => x.r)); setFind("");
      } else {
        setDraft(null); setTo([]); setFind(""); setSubject(""); setBody("");
      }
      if (draft.kind === "new" && done[0]) setOpenId(done[0].r.contact_id ?? done[0].r.email);
      await reload();
    } catch (e) { setSaid(e instanceof Error ? e.message : String(e)); }
    finally { setWorking(false); setProgress(null); }
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

  const openThread = (t: Thread) => {
    setOpenId(t.key);
    // Show what is new, the way Gmail unfolds the unread messages and the
    // last one and leaves the rest folded. Read threads open as before.
    const unread = isUnread(t);
    const fresh = unread ? t.messages.filter((m) => m.unread).map((m) => `${m.dir}-${m.id}`) : [];
    const end = t.messages[t.messages.length - 1];
    setExpanded(fresh.length && end ? new Set([...fresh, `${end.dir}-${end.id}`]) : new Set());
    if (draft?.kind === "reply") setDraft(null);
    // A click is proof somebody is looking, whatever the tab reports, so
    // opening marks it here rather than waiting on the effect above.
    if (unread) void mark([t], true);
  };

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
      </div>

      <input className="of-chat__in" placeholder="Subject" value={subject}
             disabled={working} onChange={(e) => setSubject(e.target.value)} />
      <textarea className="of-chat__in of-cw__body"
                rows={full ? 18 : draft?.kind === "new" ? 10 : 7}
                placeholder="Write a message…" value={body} disabled={working}
                onChange={(e) => setBody(e.target.value)} />

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

  const actions = (() => {
    // Say why the button is dead rather than leaving it greyed and
    // unexplained — "no recipient picked" is not obvious when the search box
    // already has text in it.
    const missing = !recipients.length
      ? "pick someone from the list, or type or paste email addresses"
      : bad.length
        ? `${bad.length === 1 ? "one address isn't" : `${bad.length} addresses aren't`} valid — click to fix, or × to drop`
      : !subject.trim() ? "add a subject"
      : !body.trim() ? "write a message"
      : null;
    const n = recipients.length;
    return (
      <>
        <button className="of-facet__b" onClick={() => void doSend()}
                disabled={working || Boolean(missing)}>
          {working ? (progress ?? "…") : n > 1 ? `Send ${n}` : "Send"}
        </button>
        <button className="of-dock__x" disabled={working}
                onClick={() => setDraft(null)}>discard</button>
        <span className="of-note">
          {missing ?? (n > 1
            ? `Goes as ${n} separate messages, one per person. Signature added for you.`
            : "Signature added for you.")}
        </span>
      </>
    );
  })();

  const title = draft?.kind === "reply" ? `Reply to ${open?.full_name ?? "them"}` : "New message";
  const tools = (
    <span className="of-cw__tools">
      <button className="of-cw__x" onClick={resize}
              title={full ? "Shrink back" : "Open full size"}
              aria-label={full ? "Shrink back" : "Open full size"}>
        <SizeIcon full={full} />
      </button>
      <button className="of-cw__x" onClick={() => setDraft(null)} disabled={working}
              title="Discard" aria-label="Discard">×</button>
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
  ) : draft.kind === "new" ? (
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

  const filters = (
    <>
      <button className="of-facet__b" aria-pressed={onlyUnread}
              onClick={() => setOnlyUnread((x) => !x)}
              title={onlyUnread ? "Show every conversation" : "Show only conversations with mail you have not opened"}>
        Unread
      </button>
      {unreadCount > 0 && (
        <button className="of-dock__x" onClick={() => void mark(threads.filter(isUnread), true)}>
          mark all read
        </button>
      )}
    </>
  );

  const newButton = (
    <button className="of-facet__b" onClick={startCompose} disabled={draft?.kind === "new"}>
      New email
    </button>
  );

  // A refusal list for thirty addresses takes longer than six seconds to read.
  const toast = <Toast message={said} onDone={() => setSaid(null)}
                       ms={Math.max(6000, (said?.length ?? 0) * 60)} />;

  if (threads.length === 0) {
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
        <nav className="of-inbox__list" aria-label="Conversations">
          {shown.map((t) => {
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
          {onlyUnread && shown.length === 0 && (
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
                            disabled={draft?.kind === "reply"}
                            title={draft?.kind === "reply" ? "Send or discard the reply first"
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

              {draft?.kind === "reply" ? (
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
                <button className="of-facet__b" style={{ marginTop: 14 }}
                        disabled={!open.email || draft?.kind === "new"} onClick={startReply}
                        title={!open.email ? "No address on record"
                          : draft ? "Send or discard the new message first"
                          : "Write to this person"}>
                  Reply
                </button>
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
