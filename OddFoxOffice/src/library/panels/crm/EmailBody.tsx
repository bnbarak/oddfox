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

/* Where a reply's quoted history starts, in the forms mail clients actually
   write it: Gmail's and Apple Mail's "On <date>, <name> wrote:" — which Gmail
   wraps onto a second line when the name is long — and Outlook's
   "-----Original Message-----" or its "From: … / Sent: …" header block.
   Failing all of those, a run of ">" lines at the very end. */
const QUOTE_HEADS = [
  /^On [^\n]*(?:\n[^\n]*)?wrote:[ \t]*$/m,
  /^-{2,}[ \t]*Original Message[ \t]*-{2,}/im,
  /^From: [^\n]+\n(?:Sent|Date): /m,
];

/** Splits a plain-text message into what was written and the history it
    quotes. `quoted` is null when there is none — or when nothing sits above
    it, since then there is nothing to fold it under. */
export function splitQuoted(text: string): { reply: string; quoted: string | null } {
  let at = -1;
  for (const re of QUOTE_HEADS) {
    const m = re.exec(text);
    if (m && (at < 0 || m.index < at)) at = m.index;
  }
  if (at < 0) {
    const lines = text.split("\n");
    let i = lines.length;
    while (i > 0 && (/^\s*$/.test(lines[i - 1]!) || lines[i - 1]!.startsWith(">"))) i--;
    if (lines.slice(i).some((l) => l.startsWith(">"))) at = lines.slice(0, i).join("\n").length;
  }
  const reply = at < 0 ? text : text.slice(0, at).trimEnd();
  if (at < 0 || !reply.trim()) return { reply: text, quoted: null };
  return { reply, quoted: text.slice(at).trim() };
}

/** Plain text, on the same white page as an HTML message — an email is an
    email, whichever part we happen to hold — with its line breaks kept and
    the quoted history folded behind "···" the way Gmail does it. The reply
    is what somebody opened the thread to read, and the quote under it is
    usually our own last message, already in the thread one card up. */
function TextBody({ text }: { text: string }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const { reply, quoted } = splitQuoted(text);
  return (
    <div className="of-msg__text">
      <div className="of-msg__plain">{reply}</div>
      {quoted && (
        <>
          <button className="of-msg__more" aria-expanded={showQuoted}
                  title={showQuoted ? "Hide the quoted text" : "Show the quoted text"}
                  onClick={() => setShowQuoted((v) => !v)}>
            ···
          </button>
          {showQuoted && <div className="of-msg__plain of-msg__quoted">{quoted}</div>}
        </>
      )}
    </div>
  );
}

/** The body of one message. Prefers the HTML part, which is what the
    recipient opened; falls back to the plain text for messages sent before
    there was an HTML part, and for inbound mail, of which we keep the text. */
export function EmailBody({ html, text }: { html?: string | null; text?: string | null }) {
  if (html) return <HtmlBody html={html} />;
  if (text) return <TextBody text={text} />;
  return null;
}
