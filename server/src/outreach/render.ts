import type { AccountRecord, ContactRecord } from "../schemas.js";
import type { OutreachConfig } from "./schemas.js";
import { linkFor } from "./unsubToken.js";

/* Turning a template in crmMeta/sequences into the exact text that will be
   sent. Two rules matter here:

   1. A message that still contains `{{something}}` must never leave the
      building. `fill` therefore reports what it could not resolve, and the
      schedule route refuses anything with leftovers.
   2. Every message carries a real sender name, a postal address and a way to
      opt out. sequences.json's own compliance_note says so, and for UK and EU
      recipients it is the law, not a nicety. */

export type Vars = Record<string, string | null>;

const FIRST = (full: string): string => full.trim().split(/\s+/)[0] ?? full;

/** Everything a template is allowed to reference, drawn from the records we
    actually hold. A value of null means "we do not know this", which is
    different from an empty string and is reported rather than silently
    papered over. */
export function varsFor(account: AccountRecord | null, contact: ContactRecord, cfg: OutreachConfig): Vars {
  return {
    first_name: FIRST(contact.full_name),
    full_name: contact.full_name,
    company: contact.company ?? account?.company ?? null,
    title: contact.title || null,
    their_role: contact.title || null,
    their_patch: contact.company ?? account?.company ?? null,
    fleet: account?.fleet != null ? String(account.fleet) : null,
    vessel: account?.vessel_attacked?.[0] ?? null,
    country: account?.country ?? null,
    sender: cfg.sender_name,
  };
}

const TOKEN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

/** Substitutes `{{key}}` from `vars`. Returns the text alongside the keys it
    could not resolve — either absent from `vars` or present but null. */
export function fill(template: string, vars: Vars): { text: string; unresolved: string[] } {
  const missing = new Set<string>();
  const text = template.replace(TOKEN, (whole, key: string) => {
    const v = vars[key.toLowerCase()];
    if (v == null || v === "") {
      missing.add(key.toLowerCase());
      return whole;
    }
    return v;
  });
  return { text, unresolved: [...missing] };
}

/** The opt-out sentence used when there is no working link — no signing key
    configured, or a recipient we cannot build one for. Replying is still a
    lawful opt-out; poll.ts reads inbound mail for it. */
export const OPT_OUT_LINE = `Reply "unsubscribe" and you will not hear from me again.`;

/** The same sentence when there IS a link. One click beats composing a reply,
    and an opt-out somebody actually completes is the only kind that counts. */
export const optOutLine = (url: string | null): string =>
  url ? `Don't want these? Unsubscribe: ${url}` : OPT_OUT_LINE;

/** Splits a rendered body at the point the appended footer begins.

    Used by the panels to show just the human-written part. Matches whichever
    opt-out sentence was used, which footer() always emits last and which no
    hand-written message contains. Exported as a pattern rather than a string
    because there are now two wordings and callers must not have to know
    which one a given message got. */
export const FOOTER_START = /\n+(?=Don't want these\? Unsubscribe:|Reply "unsubscribe")/;

/** The block that closes a message: a sign-off, and for marketing mail the
    postal address and opt-out line as well.

    `commercial` is the distinction that matters, and it is not "automated vs
    typed by hand" — it is what the law cares about. A tier sequence is
    unsolicited marketing to a stranger, so CAN-SPAM and PECR require a
    postal address and a working opt-out. A one-off note to somebody you
    already know is ordinary correspondence, and bolting an unsubscribe line
    onto it reads as machine-generated, which defeats the point of writing it
    by hand.

    Kept out of the templates on purpose: templates are copy and get
    rewritten often; this is a legal requirement on the messages that need it
    and must not depend on someone remembering. A signature only ever
    replaces the sign-off — it cannot remove the compliance lines from a
    message that needs them. */
export function footer(
  cfg: OutreachConfig, signatureId?: string | null, commercial = true,
  to?: string | null,
): string {
  const id = signatureId ?? cfg.default_signature;
  const sig = cfg.signatures.find((x) => x.id === id);
  const lines = [sig ? sig.body.trimEnd() : cfg.sender_name];
  if (commercial) {
    if (cfg.postal_address) lines.push(cfg.postal_address);
    if (cfg.unsubscribe_mailbox) lines.push(optOutLine(to ? linkFor(to) : null));
  }
  return lines.join("\n");
}

/** Body plus footer, with exactly one blank line between them however the
    body happens to end.

    No "--" separator: the RFC 3676 sig marker makes a hand-written note look
    machine-generated, which is the opposite of what this outreach is going
    for. The footer is still appended unconditionally — see footer() — so
    dropping the marker costs nothing legally. Anything that needs to find
    where the body ends should use FOOTER_START rather than matching "--". */
export const withFooter = (
  body: string, cfg: OutreachConfig, signatureId?: string | null, commercial = true,
  to?: string | null,
): string => `${body.trimEnd()}\n\n${footer(cfg, signatureId, commercial, to)}\n`;

// ---- The HTML half --------------------------------------------------------

const ESC: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]!);

/* Deliberately plain HTML.

   Everything here is inline-styled, table-free, image-free and one column,
   because that is the shape that survives every mail client and because the
   message is supposed to look like one person writing to another. A branded
   template with a header image would render worse AND read worse: cold mail
   that looks like a newsletter gets filed like a newsletter.

   The HTML is a faithful rendering of the same text, not a second version of
   it — the two parts of a multipart message disagreeing is itself a spam
   signal. The only thing HTML adds is that the opt-out is clickable. */

/* Gmail's own defaults — "Sans Serif" at "Normal" size — so a message from
   here looks like one typed in Gmail, down to the letterforms. No line-height
   and no colour for the same reason: Gmail sets neither. The footer uses
   Gmail's "Small". */
const FONT = "Arial,Helvetica,sans-serif";
const SIZE = "small";
const SIZE_SMALL = "x-small";

/** Blank-line-separated blocks become paragraphs; single newlines inside a
    block become <br>, which is what keeps a signature's line breaks. */
const paragraphs = (text: string, style: string): string =>
  text.trimEnd().split(/\n{2,}/).map((block) =>
    `<p style="${style}">${esc(block.trimEnd()).replace(/\n/g, "<br>")}</p>`).join("\n");

/** The message as HTML: the written body, then the footer, with the opt-out
    rendered as a real link when we have one. */
export function htmlBody(
  body: string, cfg: OutreachConfig, signatureId?: string | null, commercial = true,
  to?: string | null,
): string {
  const url = commercial && cfg.unsubscribe_mailbox && to ? linkFor(to) : null;
  const p = `margin:0 0 1em;font-family:${FONT};font-size:${SIZE}`;
  const small = `margin:0 0 .5em;font-family:${FONT};font-size:${SIZE_SMALL};color:#767676`;

  const id = signatureId ?? cfg.default_signature;
  const sig = cfg.signatures.find((x) => x.id === id);

  const parts = [paragraphs(body, p), paragraphs(sig ? sig.body : cfg.sender_name, p)];
  if (commercial) {
    // The compliance block, visually quieter than the message but present in
    // the same place every time. Small and grey is convention, not evasion —
    // it stays selectable, real text, and above the fold of the footer.
    const tail: string[] = [];
    if (cfg.postal_address) tail.push(esc(cfg.postal_address));
    if (cfg.unsubscribe_mailbox) {
      tail.push(url
        ? `Don't want these? <a href="${esc(url)}" style="color:#767676">Unsubscribe</a>.`
        : esc(OPT_OUT_LINE));
    }
    if (tail.length) parts.push(`<p style="${small}">${tail.join("<br>")}</p>`);
  }

  return `<div style="font-family:${FONT};font-size:${SIZE}">\n${
    parts.join("\n")}\n</div>`;
}

/** Both halves of the message from one call, so the text and the HTML can
    never drift out of step — they are built from the same inputs here and
    nowhere else. */
export function compose(
  body: string, cfg: OutreachConfig, signatureId?: string | null, commercial = true,
  to?: string | null,
): { text: string; html: string } {
  return {
    text: withFooter(body, cfg, signatureId, commercial, to),
    html: htmlBody(body, cfg, signatureId, commercial, to),
  };
}

/** Headers that make an opt-out one action in the recipient's mail client
    rather than a hunt through the text.

    Both targets when we have a link: the URL first, because Gmail and Yahoo
    only show their own one-click control for a URL, and the mailto after it
    as the fallback for clients that prefer one. `List-Unsubscribe-Post` is
    RFC 8058 — it is what promises the provider that a POST to that URL is
    the whole opt-out, with no confirmation page — and it is only honest to
    send it because the endpoint really does accept POST. */
export function listHeaders(
  cfg: OutreachConfig, commercial = true, to?: string | null,
): Record<string, string> {
  // Same rule as the footer: a personal note does not carry an unsubscribe
  // header, because it is not a mailing list.
  if (!commercial || !cfg.unsubscribe_mailbox) return {};
  const url = to ? linkFor(to) : null;
  const mailto = `<mailto:${cfg.unsubscribe_mailbox}?subject=unsubscribe>`;
  if (!url) return { "List-Unsubscribe": mailto };
  return {
    "List-Unsubscribe": `<${url}>, ${mailto}`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** True when the text of an inbound reply reads as an opt-out. Deliberately
    generous: treating a borderline reply as an opt-out costs one lead,
    treating a real opt-out as a normal reply costs a complaint. */
export function readsAsOptOut(text: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase().slice(0, 1500);
  return /\b(unsubscribe|opt[\s-]?out|remove me|take me off|stop (emailing|contacting)|do not (contact|email)|no longer wish)\b/.test(t);
}

/** True when the sender looks like a machine — a bounce notice or an
    out-of-office. Such a message is logged but must not be counted as a
    human reply, or the pipeline fills up with holidays. */
export function readsAsAutomated(from: string, subject: string | null): boolean {
  const f = from.toLowerCase();
  if (/(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce|notification)/.test(f)) return true;
  const s = (subject ?? "").toLowerCase();
  return /(out of (the )?office|automatic reply|auto[- ]?reply|undeliverable|delivery status notification|abwesenheit|absence du bureau)/.test(s);
}
