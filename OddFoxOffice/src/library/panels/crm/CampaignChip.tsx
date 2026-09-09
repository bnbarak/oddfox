import { Chip } from "../../../ui";
import { CAMPAIGN_TONE, type AccountCampaign } from "../../../lib/outreachStore";

/* An account's campaign state, in one word.

   Its own file rather than living on the page that first needed it: the
   outreach table and the account page both show it, and Outreach already
   imports AccountLink from Account, so putting it on either would make the
   two files import each other.

   A dash rather than the word "none". Most accounts are in no campaign, and a
   column full of "none" reads as a problem instead of as the normal case. */
export function CampaignChip({ of }: { of?: AccountCampaign }) {
  if (!of || of.state === "none") return <span className="of-dot-off" title="not in a campaign" />;
  // Chip takes no title, so the campaign's name goes on a wrapper — worth the
  // extra element: the state alone does not say which campaign it belongs to.
  return (
    // inline-flex, not a bare span: as a flex item a plain inline wrapper
    // carries its line box's descender space and the chip sits low next to
    // its neighbours. This was visible in the account header.
    <span title={of.campaign_name ?? undefined} style={{ display: "inline-flex" }}>
      <Chip tone={CAMPAIGN_TONE[of.state]}>{of.state}</Chip>
    </span>
  );
}
