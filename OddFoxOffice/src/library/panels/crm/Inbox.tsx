import { useEffect, useMemo, useState } from "react";
import { Chip, H1, Note } from "../../../ui";
import {
  cancelSend, sendDirect, useOutreachConfig, useOutreachStatus, useThreads,
  type Thread, type ThreadMessage,
} from "../../../lib/outreachStore";
import { CRM_CHANGED } from "./Operator";
import { useContacts } from "./shared";

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
  const body = (m.body ?? "").split("\n--\n")[0] ?? "";   // drop our own footer
  return body.replace(/\s+/g, " ").trim().slice(0, 120);
};

function Message({ m, open, onToggle, onCancel, busy }: {
  m: ThreadMessage; open: boolean; onToggle: () => void;
  onCancel: (id: string) => void; busy: boolean;
}) {
  const pullable = m.dir === "out" && (m.status === "scheduled" || m.status === "draft");
  return (
    <article className={`of-msg is-${m.dir}${open ? " is-open" : ""}`}>
      <header className="of-msg__h" onClick={onToggle} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
        <span className="of-msg__who">{m.dir === "out" ? "Seaworth" : "them"}</span>
        {!open && <span className="of-msg__peek">{snippet(m)}</span>}
        {m.dir === "out" && m.round === 0 ? <span className="of-msg__tag">one-off</span> : null}
        {m.round ? <span className="of-msg__tag">round {m.round}</span> : null}
        {m.dry_run ? <Chip tone="warm">dry run</Chip> : null}
        {m.status && !m.dry_run ? <span className="of-msg__tag">{m.status}</span> : null}
        {m.unsubscribe ? <Chip tone="hot">opted out</Chip> : null}
        {m.automated ? <Chip tone="warm">auto</Chip> : null}
        <span className="of-msg__at">{fmt(m.at)}</span>
      </header>
      {open && (
        <div className="of-msg__open">
          {m.subject && <div className="of-msg__subj">{m.subject}</div>}
          {m.body && <pre className="of-msg__body">{m.body}</pre>}
          {pullable && (
            <button className="of-dock__x" disabled={busy} onClick={() => onCancel(m.id)}>
              cancel this message
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function CrmInbox() {
  const { data, error, busy, reload } = useThreads();
  const threads = useMemo(() => data?.threads ?? [], [data]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [replying, setReplying] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [working, setWorking] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  // Composing to someone with no thread yet — the only way to start one.
  const [composing, setComposing] = useState(false);
  const [to, setTo] = useState<string>("");
  const [find, setFind] = useState("");
  const { rows: contacts } = useContacts();
  const status = useOutreachStatus();
  const senders = useMemo(() => status.data?.senders ?? [], [status.data]);
  const [fromDomain, setFromDomain] = useState<string>("");
  const conf = useOutreachConfig();
  const signatures = useMemo(() => conf.data?.signatures ?? [], [conf.data]);
  const [signature, setSignature] = useState<string>("");

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

  const open: Thread | null = threads.find((t) => t.contact_id === openId) ?? threads[0] ?? null;
  const last = open?.messages[open.messages.length - 1];

  // Only people with an address can be written to; a picker full of names
  // that cannot be selected is worse than a shorter list.
  const writable = useMemo(
    () => contacts.filter((c) => c.email)
      .filter((c) => {
        const q = find.trim().toLowerCase();
        if (!q) return true;
        return `${c.full_name} ${c.company ?? ""} ${c.title}`.toLowerCase().includes(q);
      })
      .slice(0, 60),
    [contacts, find]);

  const startCompose = () => {
    setComposing(true); setReplying(false);
    setTo(""); setFind(""); setSubject(""); setBody("");
  };

  const startReply = () => {
    const s = last?.subject ?? "";
    setSubject(s.toLowerCase().startsWith("re:") ? s : s ? `Re: ${s}` : "");
    setBody("");
    setReplying(true);
  };

  const doCancel = async (id: string) => {
    setWorking(true);
    try { setSaid((await cancelSend(id)).note); await reload(); }
    catch (e) { setSaid(e instanceof Error ? e.message : String(e)); }
    finally { setWorking(false); }
  };

  const doSend = async () => {
    const target = composing ? to : open?.contact_id;
    if (!target || !subject.trim() || !body.trim()) return;
    setWorking(true);
    try {
      const r = await sendDirect(target, subject.trim(), body.trim(),
                                 fromDomain || null, signature || null);
      setSaid(r.dry_run
        ? `Queued as a dry run for ${fmt(r.scheduled_at)} — nothing was sent.`
        : `Scheduled for ${fmt(r.scheduled_at)}. Cancellable until it goes.`);
      setReplying(false); setComposing(false); setSubject(""); setBody("");
      if (composing) setOpenId(target);
      await reload();
    } catch (e) { setSaid(e instanceof Error ? e.message : String(e)); }
    finally { setWorking(false); }
  };

  if (error) {
    return <><H1>Inbox</H1><Note><strong>The CRM server is not answering. </strong>{error}</Note></>;
  }

  const composer = !(composing || replying) ? null : (
    <div className="of-cw" role="dialog" aria-label="Compose">
      <header className="of-cw__h">
        <span>{composing ? "New message" : `Reply to ${open?.full_name ?? ""}`}</span>
        <button className="of-cw__x" onClick={() => { setComposing(false); setReplying(false); }}
                title="Close">×</button>
      </header>
      <div className="of-cw__b">
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

        {composing ? (
          <label className="of-cw__row">
            <span className="of-cw__k">To</span>
            <input className="of-cw__v of-chat__in" placeholder="Search name, company or role"
                   value={find} disabled={working}
                   onChange={(e) => { setFind(e.target.value); setTo(""); }} />
          </label>
        ) : (
          <div className="of-cw__row">
            <span className="of-cw__k">To</span>
            <span className="of-cw__v of-note">{open?.email ?? "no address on record"}</span>
          </div>
        )}

        {composing && !to && find.trim() && (
          <div className="of-to">
            {writable.length === 0 && <span className="of-note">Nobody matches, or they have no address on record.</span>}
            {writable.map((c) => (
              <button key={c.id} className="of-to__b"
                      onClick={() => { setTo(c.id); setFind(`${c.full_name} — ${c.company ?? ""}`); }}>
                <strong>{c.full_name}</strong>
                <span className="of-note"> · {c.title || "role unknown"} · {c.company ?? "—"}</span>
              </button>
            ))}
          </div>
        )}

        {signatures.length > 0 && (
          <label className="of-cw__row">
            <span className="of-cw__k">Sign</span>
            <select className="of-sel of-cw__v" value={signature} disabled={working}
                    onChange={(e) => setSignature(e.target.value)}>
              <option value="">
                {signatures.find((x) => x.id === conf.data?.default_signature)?.name ?? "Default"}
              </option>
              {signatures.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        )}
        <input className="of-chat__in" placeholder="Subject" value={subject}
               disabled={working} onChange={(e) => setSubject(e.target.value)} />
        <textarea className="of-chat__in of-cw__body" rows={10} placeholder="Write a message…"
                  value={body} disabled={working} onChange={(e) => setBody(e.target.value)} />
      </div>
      <footer className="of-cw__f">
        <button className="of-facet__b" onClick={() => void doSend()}
                disabled={working || !subject.trim() || !body.trim() || (composing && !to)}>
          {working ? "…" : "Schedule"}
        </button>
        <span className="of-note">Signature, address and opt-out line are added for you.</span>
      </footer>
    </div>
  );

  const newButton = (
    <button className="of-facet__b" onClick={startCompose} disabled={composing}>
      New email
    </button>
  );

  if (threads.length === 0) {
    return (
      <>
        <div className="of-inbox__bar">{newButton}</div>
        {said && <Note style={{ marginBottom: 12 }}>{said}</Note>}
        <Note>{busy ? "Loading…" : "Nothing here yet. Write to someone and the conversation appears here."}</Note>
        {composer}
      </>
    );
  }

  return (
    <>
      <div className="of-inbox__bar">{newButton}</div>
      {said && <Note style={{ marginBottom: 12 }}>{said}</Note>}

      <div className="of-inbox">
        <nav className="of-inbox__list" aria-label="Conversations">
          {threads.map((t) => {
            const preview = t.messages[t.messages.length - 1];
            return (
              <button key={t.contact_id}
                      className={`of-inbox__row${open?.contact_id === t.contact_id ? " is-on" : ""}${t.replied ? " is-unread" : ""}`}
                      onClick={() => { setOpenId(t.contact_id); setExpanded(new Set()); setReplying(false); }}>
                <span className="of-inbox__l1">
                  <span className="of-inbox__who">{t.full_name}</span>
                  <span className="of-inbox__at">{fmt(t.last_at)}</span>
                </span>
                <span className="of-inbox__l2">
                  <span className="of-inbox__subj">{preview?.subject ?? "(no subject)"}</span>
                  <span className="of-inbox__peek"> — {snippet(preview)}</span>
                </span>
                <span className="of-inbox__l3">
                  {t.company ?? "—"} · {t.sent} sent{t.replies ? ` · ${t.replies} in` : ""}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="of-inbox__thread">
          {open && (
            <>
              <header className="of-inbox__head">
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
                           onCancel={(id) => void doCancel(id)} />
                );
              })}

              <button className="of-facet__b" style={{ marginTop: 14 }}
                      disabled={!open.email} onClick={startReply}
                      title={open.email ? "Write to this person" : "No address on record"}>
                Reply
              </button>
            </>
          )}
        </div>
      </div>
      {composer}
    </>
  );
}
