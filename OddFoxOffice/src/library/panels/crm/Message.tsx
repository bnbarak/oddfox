import type { AccountCampaign, ThreadMessage } from "../../../lib/outreachStore";
import { CampaignTag } from "./CampaignChip";
import { EmailBody } from "./EmailBody";
import { SequenceLink } from "./SequenceModal";
import { SendState } from "./SendState";
import { at } from "./shared";

/* One message, read like an email rather than like a log line, on a page that
   is not the Inbox — an account's history, or a person's. The Inbox has its
   own, collapsible, because there you are reading one conversation; here you
   are reading everything at once and every message is open. */

/* It used to put the recipient above the card, the sender and status inside
   it, and the subject floating over the body — three separate places for the
   header of one email. Now the subject leads, because that is what you are
   looking for, and everything else is one meta line under it. */
export function Message({ m, who, campaign, onSequence, onCancel, onNow, busy, extra }: {
  m: ThreadMessage;
  /** Who this was to, or from — the counterparty either way. */
  who: string;
  /** The campaign this account is in, if any. */
  campaign?: AccountCampaign;
  onSequence?: () => void;
  onCancel?: (id: string) => void;
  onNow?: (id: string) => void;
  busy?: boolean;
  /** Anything the page wants on the meta line — a link to the conversation
      this message belongs to, say. */
  extra?: React.ReactNode;
}) {
  const pullable = m.dir === "out" && (m.status === "scheduled" || m.status === "draft");
  return (
    <article className={`of-msg is-${m.dir} is-open`}>
      <div className="of-msg__open">
        {m.subject ? <div className="of-msg__subj">{m.subject}</div> : null}

        <div className="of-msg__meta">
          <span>{m.dir === "out" ? "to" : "from"} {who}</span>
          {m.round ? <CampaignTag of={campaign} /> : null}
          {m.round ? (
            <SequenceLink tier={m.template_tier ?? 1} round={m.round} />
          ) : null}
          {m.round && onSequence ? (
            <button className="of-msg__tag of-msg__tag--btn" onClick={onSequence}
                    title="See this person's whole sequence">sequence</button>
          ) : null}
          {m.dry_run ? <span className="of-msg__tag">dry run</span> : null}
          <SendState m={m} />
          {extra}
          <span className="of-msg__at">{at(m.at)}</span>
        </div>

        <EmailBody html={m.html} text={m.body} />

        {pullable && (onNow || onCancel) ? (
          <div className="of-msg__acts">
            {onNow ? (
              <button className="of-facet__b" disabled={busy}
                      title="skip the wait — goes in about a minute, still cancellable"
                      onClick={() => onNow(m.id)}>send now</button>
            ) : null}
            {onCancel ? (
              <button className="of-dock__x" disabled={busy}
                      onClick={() => onCancel(m.id)}>cancel this message</button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
