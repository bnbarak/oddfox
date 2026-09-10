import { useEffect } from "react";
import { UNREAD_CHANGED, useUnread } from "../../../lib/outreachStore";

/** Gmail's "Inbox 3": how many conversations hold mail you have not opened,
    beside the tab, so it shows from anywhere in the CRM rather than only once
    you are already looking at the inbox. A count, not the threads — this
    polls on every CRM page and has no use for the bodies.

    The inbox announces when it marks something, so opening a thread takes
    the number down straight away instead of at the next poll. */
export function InboxBadge() {
  const { data, reload } = useUnread();
  useEffect(() => {
    const r = () => void reload();
    window.addEventListener(UNREAD_CHANGED, r);
    return () => window.removeEventListener(UNREAD_CHANGED, r);
  }, [reload]);
  const n = data?.unread ?? 0;
  return n > 0 ? <span className="of-badge" aria-label={`${n} unread`}>{n}</span> : null;
}
