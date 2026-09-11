import { useEffect, useRef, useState } from "react";
import { UNREAD_CHANGED, useThreads, useUnread, type Thread } from "./lib/outreachStore";

/* A bell beside the avatar, with the number of conversations holding mail you
   have not opened — the same count as the Inbox tab's badge, but on every
   page, decks included, so new mail shows wherever you are.

   New mail is the only kind of notification the app has today; when there
   are others, this is where they belong.

   It lives outside the router — AuthGate renders it above RouterProvider —
   so it cannot use useNavigate. It moves the way the router itself listens
   for a move: pushState, then a popstate event. */

const INBOX = "/library/crm-inbox";

const go = (path: string) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

/** A time for today's mail, a date for anything older — as a mail list does. */
const when = (at: string): string => {
  const d = new Date(at);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

export function Bell() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { data, reload } = useUnread();

  // The inbox announces when it marks something read, so the count drops the
  // moment a conversation is opened rather than at the next poll.
  useEffect(() => {
    const r = () => void reload();
    window.addEventListener(UNREAD_CHANGED, r);
    return () => window.removeEventListener(UNREAD_CHANGED, r);
  }, [reload]);

  // Click-away and Escape, the same as the avatar's menu.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  const n = data?.unread ?? 0;
  const label = n ? `${n} conversation${n === 1 ? "" : "s"} with new mail` : "No new mail";

  return (
    <div className="of-bell" ref={box}>
      <button className={`of-bell__b${n ? " has-new" : ""}`} onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {n > 0 && <span className="of-bell__n">{n > 99 ? "99+" : n}</span>}
      </button>

      {open && (
        <BellMenu onPick={(key) => {
          setOpen(false);
          go(key ? `${INBOX}?thread=${encodeURIComponent(key)}` : INBOX);
        }} />
      )}
    </div>
  );
}

/** Mounted only while open, so the conversations themselves are fetched when
    somebody looks, rather than polled on every page just to show a number. */
function BellMenu({ onPick }: { onPick: (key: string | null) => void }) {
  const { data, error } = useThreads();
  const fresh = (data?.threads ?? [])
    .filter((t) => t.unread > 0)
    .sort((a, b) => b.last_at.localeCompare(a.last_at))
    .slice(0, 8);
  const newest = (t: Thread) => [...t.messages].reverse().find((m) => m.unread) ?? null;

  return (
    <div className="of-bell__menu" role="menu">
      <div className="of-bell__head">New mail</div>
      {error ? <div className="of-bell__none">{error}</div>
        : !data ? <div className="of-bell__none">Loading…</div>
        : fresh.length === 0 ? <div className="of-bell__none">Nothing new.</div>
        : fresh.map((t) => {
            const m = newest(t);
            return (
              <button key={t.key} className="of-bell__item" role="menuitem"
                      onClick={() => onPick(t.key)}>
                <span className="of-bell__l1">
                  <strong>{t.full_name}</strong>
                  <span>{when(m?.at ?? t.last_at)}</span>
                </span>
                <span className="of-bell__l2">
                  {m?.subject ?? "(no subject)"}{t.unread > 1 ? ` · ${t.unread} new` : ""}
                </span>
              </button>
            );
          })}
      <button className="of-bell__all" role="menuitem" onClick={() => onPick(null)}>
        Open inbox
      </button>
    </div>
  );
}
