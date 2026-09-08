import { useEffect, useMemo, useState } from "react";
import { Chip, H1, Note } from "../../../ui";
import { cancelSend, sendDirect, useThreads, type Thread, type ThreadMessage } from "../../../lib/outreachStore";
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

  useEffect(() => {
    const r = () => void reload();
    window.addEventListener(CRM_CHANGED, r);
    return () => window.removeEventListener(CRM_CHANGED, r);
  }, [reload]);

  const open: Thread | null = composing
    ? null
    : threads.find((t) => t.contact_id === openId) ?? threads[0] ?? null;
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
      const r = await sendDirect(target, subject.trim(), body.trim());
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

  const composer = (
    <div className="of-compose">
      {composing && (
        <>
          <input className="of-chat__in" placeholder="To — search by name, company or role"
                 value={find} disabled={working}
                 onChange={(e) => { setFind(e.target.value); setTo(""); }} />
          {!to && find.trim() && (
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
        </>
      )}
      <input className="of-chat__in" placeholder="Subject" value={subject}
             disabled={working} onChange={(e) => setSubject(e.target.value)} />
      <textarea className="of-chat__in" rows={8} placeholder="Write a message…"
                value={body} disabled={working} onChange={(e) => setBody(e.target.value)} />
      <div className="of-compose__bar">
        <button className="of-facet__b" onClick={() => void doSend()}
                disabled={working || !subject.trim() || !body.trim() || (composing && !to)}>
          {working ? "…" : "Schedule"}
        </button>
        <button className="of-dock__x"
                onClick={() => { setComposing(false); setReplying(false); }}>discard</button>
        <span className="of-note">Signature, address and opt-out line are added for you.</span>
      </div>
    </div>
  );

  const newButton = (
    <button className="of-facet__b" onClick={startCompose} disabled={composing}>
      New email
    </button>
  );

  if (threads.length === 0 && !composing) {
    return (
      <>
        <div className="of-inbox__bar"><H1>Inbox</H1>{newButton}</div>
        {said && <Note style={{ marginBottom: 12 }}>{said}</Note>}
        <Note>{busy ? "Loading…" : "Nothing here yet. Write to someone and the conversation appears here."}</Note>
      </>
    );
  }

  return (
    <>
      <div className="of-inbox__bar"><H1>Inbox</H1>{newButton}</div>
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
          {composing && (
            <>
              <header className="of-inbox__head">
                <div className="of-inbox__title">New email</div>
                <div className="of-note">Goes out under the same cap, footer and dry-run switch as everything else.</div>
              </header>
              {composer}
            </>
          )}
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

              {!replying ? (
                <button className="of-facet__b" style={{ marginTop: 14 }}
                        disabled={!open.email} onClick={startReply}
                        title={open.email ? "Write to this person" : "No address on record"}>
                  Reply
                </button>
              ) : composer}
            </>
          )}
        </div>
      </div>
    </>
  );
}
