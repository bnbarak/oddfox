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
  if (cfg.dry_run) {
    out.push({ code: "dry-run", detail: "dry_run is on — messages are written and logged but never sent." });
  }
  return out;
}

export const domainOf = (cfg: OutreachConfig, domain: string): SendingDomain | null =>
  cfg.domains.find((d) => d.domain === domain) ?? null;

export const capOf = (cfg: OutreachConfig, domain: string): number =>
  domainOf(cfg, domain)?.daily_cap ?? cfg.default_daily_cap;

/** The address a domain sends as, e.g. `Barak <barak@seaworth.ai>`. */
export function fromAddress(cfg: OutreachConfig, domain: string): string | null {
  const d = domainOf(cfg, domain);
  return d ? `${d.from_name} <${d.from_local}@${d.domain}>` : null;
}
