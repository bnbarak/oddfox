import type { OutreachConfig, SendingDomain } from "./schemas.js";

/* Derived reads over the config document. The document itself lives in
   store.ts with everything else that is persisted. */

/** Reads a secret out of the environment, treating whitespace as unset.

    Secret Manager will not store an empty payload, so a secret that exists
    but has no key yet holds a single space. Without the trim, " " is truthy
    and the engine would believe it was configured and start making Resend
    calls with a blank key. */
export const secret = (name: string): string | null => {
  const v = process.env[name]?.trim();
  return v ? v : null;
};

/** The only addresses this system may ever send as.

    Hardcoded for the same reason auth.ts hardcodes its allow-list: who we
    appear to be is not something that should change because a document was
    edited. Resend will happily send from any address at a verified domain —
    random@seaworth.io included — so the constraint has to live here.

    It is also a deliverability rule. Cold outreach scattered across many
    local parts on a young domain is one of the clearer spam signals there
    is; one consistent human sender per domain is what a real person looks
    like. Adding a sender is a deliberate code change and a deploy. */
export const SENDERS = [
  { domain: "seaworth.io", from_local: "barak", from_name: "Barak Nissim" },
  { domain: "theseaworth.com", from_local: "barak", from_name: "Barak Nissim" },
  // Personal. Present so it can be picked by hand in the Inbox; kept off the
  // automated path by manual_only, and out of the CRM's reply store by
  // listen_inbound: false.
  { domain: "seaworth.ai", from_local: "barak", from_name: "Barak Nissim" },
] as const;

export const senderFor = (domain: string) =>
  SENDERS.find((x) => x.domain === domain.toLowerCase()) ?? null;

export type Blocker = { code: string; detail: string };

/** Everything standing between the current configuration and a live send, as
    a list rather than one error — the panel shows all of them at once so
    setup is finished in one pass, not one round trip per missing field.
    Empty means sending is possible. */
export function blockers(cfg: OutreachConfig): Blocker[] {
  const out: Blocker[] = [];
  if (!secret("RESEND_API_KEY")) {
    out.push({ code: "no-api-key", detail: "RESEND_API_KEY is not set on the server." });
  }
  if (cfg.domains.filter((d) => d.enabled).length === 0) {
    out.push({ code: "no-domains", detail: "No sending domain is configured and enabled." });
  }
  if (!cfg.postal_address) {
    out.push({ code: "no-postal-address",
               detail: "A real postal address is required in commercial email to UK and EU recipients." });
  }
  if (!cfg.unsubscribe_mailbox) {
    out.push({ code: "no-unsubscribe-mailbox",
               detail: "An opt-out address is required; it is also the List-Unsubscribe target." });
  }
  // A configured domain with no hardcoded sender can never send, so say so
  // here rather than failing at the moment somebody tries.
  const unknown = cfg.domains.filter((d) => d.enabled && !senderFor(d.domain));
  if (unknown.length) {
    out.push({
      code: "unknown-sender",
      detail: `No sender is defined in SENDERS for ${unknown.map((d) => d.domain).join(", ")}.`,
    });
  }
  if (cfg.dry_run) {
    out.push({ code: "dry-run", detail: "dry_run is on — messages are written and logged but never sent." });
  }
  return out;
}

export const domainOf = (cfg: OutreachConfig, domain: string): SendingDomain | null =>
  cfg.domains.find((d) => d.domain === domain) ?? null;

export const capOf = (cfg: OutreachConfig, domain: string): number =>
  domainOf(cfg, domain)?.daily_cap ?? cfg.default_daily_cap;

/** The address a domain sends as, e.g. `Barak Nissim <barak@seaworth.io>`.

    Read from SENDERS, not from the config document — the document decides
    whether a domain is used and how much, never who it claims to be. A
    domain that is not in SENDERS cannot produce an address, and send.ts
    refuses rather than guessing one. */
export function fromAddress(_cfg: OutreachConfig, domain: string): string | null {
  const s = senderFor(domain);
  return s ? `${s.from_name} <${s.from_local}@${s.domain}>` : null;
}
