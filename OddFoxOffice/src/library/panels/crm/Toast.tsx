import { useEffect } from "react";

/* A transient confirmation.

   These messages — "cancelled at Resend and the day's slot returned",
   "scheduled for 4:02 PM" — report that something just happened. Rendered
   inline they push the page down and then sit there looking like state, when
   they are really an event. A toast appears, says it, and leaves. */

export function Toast({ message, onDone, ms = 6000 }: {
  message: string | null; onDone: () => void; ms?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(t);
  }, [message, onDone, ms]);

  if (!message) return null;
  return (
    <div className="of-toast" role="status" aria-live="polite">
      <span>{message}</span>
      <button className="of-toast__x" onClick={onDone} title="Dismiss">×</button>
    </div>
  );
}
