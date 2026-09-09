import { Chip } from "../../../ui";
import type { EnrichmentRow } from "../../../lib/outreachStore";

/* A person's address, or the reason there isn't one.

   Three states, not two. An empty cell conflates "nobody has looked" with
   "we looked and there is nothing", and those are opposite instructions: the
   first is a research job, the second is closed and must not be retried —
   retrying it is the one thing that would make this system expensive.

   Shared by the People table and the account page so the same person never
   reads as findable on one and not on the other. */
export function EmailCell({ email, found }: {
  email: string | null | undefined;
  /** This person's row in the enrichment ledger, if we have ever asked. */
  found?: EnrichmentRow;
}) {
  if (email) return <a className="of-link of-site" href={`mailto:${email}`}>{email}</a>;

  if (found && !found.matched) {
    return (
      <span title={`${found.note ?? "Apollo has no work email for this person"} · looked up ${
        new Date(found.at).toLocaleDateString()}`}>
        <Chip tone="warm">can’t find</Chip>
      </span>
    );
  }
  return <span className="of-dot-off" title="no address on record — not looked up yet" />;
}
