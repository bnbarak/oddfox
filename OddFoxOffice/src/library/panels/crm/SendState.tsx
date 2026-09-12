import { Chip } from "../../../ui";
import type { ThreadMessage } from "../../../lib/outreachStore";
import { SEND_TONE } from "./shared";

/* What happened to a message we sent, in the two parts it actually has.

   Delivery — did it reach the mailbox — and reading — did anybody open it.
   They used to be one word, so an open overwrote "delivered" and a message
   that was read looked like a message that had not arrived yet. Now they sit
   side by side: DELIVERED · OPENED.

   Shared by the thread, the account page and the sequence grid so one
   message never reads differently depending on where you found it. */

const when = (iso: string): string => new Date(iso).toLocaleString();

export function SendState({ m }: {
  m: Pick<ThreadMessage, "status" | "opened_at" | "clicked_at" | "dry_run">;
}) {
  // A dry run went nowhere, so neither half applies: the "dry run" tag beside
  // this is the whole story.
  if (m.dry_run) return null;
  return (
    <>
      {m.status ? <Chip tone={SEND_TONE[m.status] ?? ""}>{m.status}</Chip> : null}
      {/* A click is the stronger fact and implies the open, so it stands in
          for it rather than adding a second chip to every read message. */}
      {m.clicked_at ? (
        <span title={`clicked a link ${when(m.clicked_at)}`}><Chip tone="calm">clicked</Chip></span>
      ) : m.opened_at ? (
        <span title={`opened ${when(m.opened_at)}`}><Chip tone="cool">opened</Chip></span>
      ) : null}
    </>
  );
}
