import type { SendRecord, SendStatus } from "./schemas.js";

/* What a send record means, derived in one place.

   Two questions that used to be one. "Where did the message get to" and "did
   anybody read it" were both squashed into `status`, so an open overwrote
   `delivered` and a thread could not show that a message both arrived and was
   read. Delivery stays in `status`; reading is `opened_at` and `clicked_at`.

   Rows written before that split still carry "opened" or "clicked" as their
   status. Every reader goes through these helpers, so those rows keep meaning
   what they meant — no migration, and nothing that reads the collection has
   to know there are two shapes. */

const READ = new Set(["opened", "clicked"]);

/** How far it got towards the mailbox. Never "opened": that is not a
    delivery state, and a message that was opened was delivered. */
export const delivery = (s: SendRecord): string =>
  READ.has(s.status) ? "delivered" : s.status;

/** When the recipient first opened it, as far as we know.

    The fallback is for rows saved before opened_at existed: their status is
    the only record that it happened, and updated_at is when the poll saw it
    — the same thing the field would have held. */
export const openedAt = (s: SendRecord): string | null =>
  s.opened_at ?? (READ.has(s.status) ? s.updated_at : null);

export const clickedAt = (s: SendRecord): string | null =>
  s.clicked_at ?? (s.status === "clicked" ? s.updated_at : null);

/** Ranked so a later event cannot move a message backwards. The two reading
    events sit at the delivery they imply — they are recorded as timestamps,
    not as a stage — and rows saved before that split still hold them as a
    status, which is why those still have a rank. */
const RANK: Record<string, number> = {
  draft: 0, scheduled: 1, sent: 2, delivered: 3, opened: 3, clicked: 3,
  bounced: 6, complained: 6, failed: 6, canceled: 6,
};

/* An open or a click says the message arrived, so both count as delivered;
   that it was read is kept beside the status, never in it. */
const EVENTS: Record<string, SendStatus> = {
  sent: "sent", delivered: "delivered", opened: "delivered", clicked: "delivered",
  bounced: "bounced", complained: "complained", failed: "failed",
  canceled: "canceled", scheduled: "scheduled", delivery_delayed: "delivered",
};

/** What one Resend event tells us about a row that we did not already know.
    Empty when it says nothing new, which is the common case — the poll asks
    about every unfinished message every minute.

    `at` is when we heard, not when it happened: Resend reports only the
    latest event for a message and no timestamp with it. A click arriving
    with no open before it — the two can land between one poll and the next
    — still means somebody opened the message, so it stamps both. */
export function learn(s: SendRecord, event: string, at: string): Partial<SendRecord> {
  const patch: Partial<SendRecord> = {};

  /* A row saved before the split keeps the only evidence it was read in its
     status. Carry that across before anything below rewrites the status to
     "delivered", or normalising the row would throw the open away — the
     fallback in openedAt reads the status, and after the rewrite there would
     be nothing left to read. */
  const already = openedAt(s);
  const clicked = clickedAt(s);
  if (already && !s.opened_at) patch.opened_at = already;
  if (clicked && !s.clicked_at) patch.clicked_at = clicked;

  if ((event === "opened" || event === "clicked") && !already) patch.opened_at = at;
  if (event === "clicked" && !clicked) patch.clicked_at = at;

  const next = EVENTS[event];
  if (next && (RANK[next] ?? 0) >= (RANK[s.status] ?? 0)
      && !(next === s.status && event === s.last_event)) {
    patch.status = next;
    patch.last_event = event;
  }
  return patch;
}

/** Whether this message is marketing: a sequence round, or anything a
    campaign produced.

    The rest is correspondence — a note somebody typed to one person from the
    Inbox. It belongs in the thread, not in the outreach numbers: counting it
    makes "37 sent, 11 accounts touched" a number about two different
    activities, and the one you came to the page to judge is the campaign. */
export const isMarketing = (s: SendRecord): boolean =>
  s.round > 0 || Boolean(s.campaign_id);
