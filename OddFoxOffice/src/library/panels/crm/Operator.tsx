import { useEffect, useRef, useState } from "react";
import { Note } from "../../../ui";
import { clearThread, sendChat, useThread } from "../../../lib/outreachStore";

/* The operator agent, docked on every CRM page.

   It lives in the layout rather than inside one panel because the questions
   you want to ask it — who is overdue, what is left today, cancel that one —
   are the same whether you are looking at Accounts, People or the heat map.
   Having to navigate to a particular tab to ask is exactly the friction the
   agent is meant to remove.

   Anything the agent does changes the tables underneath it, so each turn
   fires a `crm:changed` event. Panels listen for it and reload themselves;
   the dock does not need to know which panel is mounted. */

export const CRM_CHANGED = "crm:changed";

const OPEN_KEY = "crm.operator.open";

function readOpen(): boolean {
  // A private window or blocked site data makes this throw rather than
  // return null, so it has to be guarded, not just null-checked.
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function Operator() {
  const thread = useThread();
  const [open, setOpen] = useState(readOpen);
  const [pending, setPending] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const log = useRef<HTMLDivElement | null>(null);

  const turns = thread.data?.turns ?? [];
  const enabled = thread.data?.model_configured ?? false;
  const unreachable = thread.error;

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch { /* not important enough to fail on */ }
    // The rail is fixed, so the page has to be told to make room for it.
    // A data attribute rather than a prop: only CSS needs to know, and the
    // panels underneath should not have to thread this through.
    document.body.dataset.crmDock = open ? "open" : "closed";
    return () => { delete document.body.dataset.crmDock; };
  }, [open]);

  useEffect(() => {
    if (open) log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [turns.length, busy, open]);

  const ask = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setPending(text);          // shown at once; the server owns the real thread
    setBusy(true);
    setError(null);
    try {
      await sendChat(text);
      await thread.reload();
      window.dispatchEvent(new CustomEvent(CRM_CHANGED));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const forget = async () => {
    setBusy(true);
    try {
      await clearThread();
      await thread.reload();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="of-dock__tab" onClick={() => setOpen(true)}
              title="Ask the outreach agent">
        Ask the agent{turns.length ? <span className="of-dock__n">{turns.length}</span> : null}
      </button>
    );
  }

  return (
    <aside className="of-dock" aria-label="Outreach agent">
      <div className="of-dock__head">
        <span className="of-dock__title">Ask the agent</span>
        {turns.length > 0 && (
          <button className="of-dock__x" disabled={busy} title="Clear the shared thread"
                  onClick={() => void forget()}>clear</button>
        )}
        <button className="of-dock__x" onClick={() => setOpen(false)} title="Collapse">–</button>
      </div>

      {unreachable && (
        <Note style={{ margin: 12 }}>
          The CRM server is not answering ({unreachable}).
        </Note>
      )}
      {!unreachable && !enabled && (
        <Note style={{ margin: 12 }}>
          <strong>The agent is not running. </strong>
          <code>GOOGLE_API_KEY</code> is not set on the server.
        </Note>
      )}

      <div className="of-chat__log" ref={log}>
        {turns.length === 0 && (
          <p className="of-note">
            Ask for what you want. “Who at Bernhard Schulte have we not written to?” ·
            “Draft round 2 for the Pacific Basin fleet people” · “What is left today?” ·
            “Cancel the one to Ana”. It shows you a message before it schedules anything.
          </p>
        )}
        {turns.map((m) => (
          <div key={`${m.at}-${m.role}`} className={`of-chat__m is-${m.role}`}>{m.content}</div>
        ))}
        {pending && <div className="of-chat__m is-user">{pending}</div>}
        {busy && <div className="of-chat__m is-assistant of-note">thinking…</div>}
      </div>

      <div className="of-chat__bar">
        <textarea
          className="of-chat__in" rows={2} value={input} disabled={!enabled || busy}
          placeholder={enabled ? "Ask the agent…" : "unavailable"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); }
          }}
        />
        <button className="of-facet__b" disabled={!enabled || busy || !input.trim()}
                onClick={() => void ask()}>
          {busy ? "…" : "Send"}
        </button>
      </div>
      {error && <Note style={{ margin: 12 }}>{error}</Note>}
    </aside>
  );
}
