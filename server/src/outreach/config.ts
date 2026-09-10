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
  { domain: "seaworth.io", from_local: "barak", from_name: "Barak Ben Noon" },
  { domain: "theseaworth.com", from_local: "barak", from_name: "Barak Ben Noon" },
  // Personal. Present so it can be picked by hand in the Inbox; kept off the
  // automated path by manual_only, and out of the CRM's reply store by
  // listen_inbound: false.
  { domain: "seaworth.ai", from_local: "barak", from_name: "Barak Ben Noon" },
] as const;

export const senderFor = (domain: string) =>
  SENDERS.find((x) => x.domain === domain.toLowerCase()) ?? null;

/** Domains we own that are not sending identities.

    Deliberately separate from SENDERS and from the config document's
    `domains`, because these are a different kind of fact. A sending domain
    is an operational setting — it has a cap, it gets picked, it warms. One
    of these is a *property record*: something registered, renewing, pointed
    somewhere, and easy to forget we are paying for. Nothing here can send.

    A domain graduating to a sending identity is not an edit to this list —
    it is DNS, Resend verification, a SENDERS entry and a warm-up, and until
    all four exist it belongs here and nowhere else. Kept in the server for
    the same reason SENDERS is: a record of what we own should not change
    because a page was edited. */
export const MARKETING_DOMAINS = [
  {
    domain: "seaworthhq.com",
    purpose: "Reserved as a second outreach sending domain — not yet warmed.",
    registrar: "Google Cloud Domains",
    dns_zone: "seaworthhq-com",
    /* The point of registering it early: a sending domain wants age before
       it wants traffic, and the registration clock starts now rather than on
       the day we decide to use it. */
    note: "Added to Resend with sending and receiving on; DKIM/SPF/DMARC and MX go in its " +
      "Cloud DNS zone. Verification is DNS — Resend polls for the records, nothing is emailed. " +
      "Still needs a warm-up before it earns a SENDERS entry.",
  },
  {
    domain: "tryseaworth.com",
    purpose: "Campaign landing pages.",
    registrar: "Google Cloud Domains",
    dns_zone: "tryseaworth-com",
    /* Set up in Resend for mail as well as web. Worth knowing rather than
       arguing with: an MX record is at the apex, so every address here is a
       mailbox Resend receives, and a landing-page domain that also carries
       mail has two reputations to keep rather than one. */
    note: "In Resend with sending and receiving on, so it carries mail as well as the pages. " +
      "Not a sending identity: no SENDERS entry, so the engine still cannot send as it.",
  },
] as const;

export type MarketingDomain = (typeof MARKETING_DOMAINS)[number];

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
