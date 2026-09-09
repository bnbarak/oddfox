import { Chip } from "../../../ui";
import { TONE_VAR } from "../../../ui/tokens";
import { CAMPAIGN_TONE, type AccountCampaign } from "../../../lib/outreachStore";

/* An account's campaign state.

   Its own file rather than living on the page that first needed it: the
   outreach table and the account page both show it, and Outreach already
   imports AccountLink from Account, so putting it on either would make the
   two files import each other.

   Two shapes for two places. A worded chip where there is room to read it,
   and a square where there is not — "not started" in a column beside twelve
   week cells wrapped onto two lines and pushed the row out of shape. The
   square carries the same information in the tooltip, which is how the rest
   of this table already works. */

const LABEL = (of: AccountCampaign) =>
  of.campaign_name ? `${of.campaign_name} — ${of.state}` : of.state;

export function CampaignChip({ of, square = false }: {
  of?: AccountCampaign;
  /** Colour only, for narrow columns. */
  square?: boolean;
}) {
  if (!of || of.state === "none") {
    return <span className="of-dot-off" title="not in a campaign" />;
  }
  if (square) {
    return (
      <span className="of-camp__sq" title={LABEL(of)}
            style={{ background: TONE_VAR[CAMPAIGN_TONE[of.state]] }} />
    );
  }
  // inline-flex, not a bare span: as a flex item a plain inline wrapper
  // carries its line box's descender space and the chip sits low next to its
  // neighbours.
  return (
    <span title={LABEL(of)} style={{ display: "inline-flex" }}>
      <Chip tone={CAMPAIGN_TONE[of.state]}>{of.state}</Chip>
    </span>
  );
}
