import type { AccountRecord, ContactRecord } from "../schemas.js";
import type { OutreachConfig } from "./schemas.js";

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

/** The opt-out sentence, and the marker for where an appended footer
    begins in a rendered body. */
export const OPT_OUT_LINE = `Reply "unsubscribe" and you will not hear from me again.`;

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
): string {
  const id = signatureId ?? cfg.default_signature;
  const sig = cfg.signatures.find((x) => x.id === id);
  const lines = [sig ? sig.body.trimEnd() : cfg.sender_name];
  if (commercial) {
    if (cfg.postal_address) lines.push(cfg.postal_address);
    if (cfg.unsubscribe_mailbox) lines.push(OPT_OUT_LINE);
  }
  return lines.join("\n");
}

/** Body plus footer, with exactly one blank line between them however the
    body happens to end.

    No "--" separator: the RFC 3676 sig marker makes a hand-written note look
    machine-generated, which is the opposite of what this outreach is going
    for. The footer is still appended unconditionally — see footer() — so
    dropping the marker costs nothing legally. Anything that needs to find
    where the body ends should use footerStart() rather than matching "--". */
export const withFooter = (
  body: string, cfg: OutreachConfig, signatureId?: string | null, commercial = true,
): string => `${body.trimEnd()}\n\n${footer(cfg, signatureId, commercial)}\n`;

/** Where the appended footer begins in a rendered body, or -1. Used to show
    just the human-written part. Matches the opt-out line, which footer()
    always emits last and which no hand-written message would contain. */

/** Headers that make an opt-out one action in the recipient's mail client
    rather than a hunt through the text. mailto rather than a URL because the
    API has no public unencrypted surface to host a click endpoint on, and a
    mailto target is honoured by every major client. */
export function listHeaders(cfg: OutreachConfig, commercial = true): Record<string, string> {
  // Same rule as the footer: a personal note does not carry an unsubscribe
  // header, because it is not a mailing list.
  if (!commercial || !cfg.unsubscribe_mailbox) return {};
  return { "List-Unsubscribe": `<mailto:${cfg.unsubscribe_mailbox}?subject=unsubscribe>` };
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
