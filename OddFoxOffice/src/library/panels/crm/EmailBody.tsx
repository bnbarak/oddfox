import { useCallback, useEffect, useRef, useState } from "react";

/* One place that draws the body of an email, used by every surface that shows
   one: the Inbox thread, an account's history, the sequence library, the
   footer preview in Settings.

   It exists because there were three of them and they disagreed. Two rendered
   the plain-text part in a <pre>, one showed a truncated excerpt, and none of
   them showed the HTML we actually send — so the panels answered "what did we
   send this person" with something nobody received. Whatever "what was sent"
   looks like, it should look the same in all four places, and changing it
   should be one edit.

   HTML goes in a sandboxed iframe rather than through dangerouslySetInnerHTML,
   for two reasons that are both about the same thing. The obvious one: an
   email body is untrusted — we generate the outbound ones, but an inbound
   message is written by a stranger, and one <script> or one styled overlay
   inside the CRM would be a real problem. The less obvious one: an email is a
   whole document with its own colours, sized for a white background. Dropped
   into this dark app it renders as a light rectangle with the app's own CSS
   fighting it. An iframe is a clean document boundary, which is exactly what
   an email is.

   `sandbox` without allow-scripts means nothing in the document can run.
   `allow-same-origin` is there only so this component can measure the
   rendered height from outside; with scripts off it grants the document
   nothing it could use. */

/** Wraps a fragment as a document: white page, sensible defaults, and every
    link opening in a new tab rather than replacing the panel. */
const asDocument = (html: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><base target="_blank">
<style>
  html,body { margin:0; padding:0; background:#fff; color:#222; }
  body { padding:14px 16px; font:small Arial,Helvetica,sans-serif;
         overflow-wrap:anywhere; }
  img { max-width:100%; height:auto; }
</style></head><body>${html}</body></html>`;

function HtmlBody({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(120);

  /* Sized to its content, because an email has no natural height and a fixed
     one either clips a long message or leaves a hole under a short one — and
     a scrollbar inside a message inside a thread is unreadable.

     Two things this has to get right, both learned the hard way:

     Measure the BODY, not documentElement. documentElement.scrollHeight is at
     least the iframe's own viewport, so feeding it back into the iframe's
     height is a ratchet that only ever grows — a 331px message measured that
     way settled at 8892px of white space.

     And measure after layout, not during onload. At the moment onload fires
     the document has not been laid out at the iframe's real width, and the
     number it gives back is nonsense. A ResizeObserver on the body says so
     whenever the answer actually changes, which also covers the panel being
     resized and a web font arriving late. */
  const watch = useCallback(() => {
    const body = frame.current?.contentDocument?.body;
    if (!body) return;
    observer.current?.disconnect();
    const ro = new ResizeObserver(() =>
      setHeight(Math.max(60, Math.ceil(body.getBoundingClientRect().height))));
    ro.observe(body);
    observer.current = ro;
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return (
    <iframe
      ref={frame}
      className="of-msg__html"
      title="Message"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={asDocument(html)}
      onLoad={watch}
      style={{ height }}
    />
  );
}

/** The body of one message. Prefers the HTML part, which is what the
    recipient opened; falls back to the plain text for messages sent before
    there was an HTML part, and for inbound mail, of which we only keep text. */
export function EmailBody({ html, text }: { html?: string | null; text?: string | null }) {
  if (html) return <HtmlBody html={html} />;
  if (text) return <pre className="of-msg__body">{text}</pre>;
  return null;
}
