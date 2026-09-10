import type { Thread, ThreadMessage } from "./threads.js";

/* Read and unread, per person, the way Gmail does it.

   Two people work this inbox and each has their own idea of what they have
   seen, so the state belongs to the person rather than to the thread — one of
   them opening a reply must not make it vanish from the other's unread.

   What is stored is not "read at" but "read through": for each thread, the
   arrival time of the newest incoming message the person has actually seen.
   A clock time would be wrong in exactly the case that matters. The poller
   stores a reply some minutes after it arrived, stamped with when it arrived;
   open the thread in between and a read-at of "now" sits after a reply that
   had not been fetched yet, so it would land already read.

   Kept free of Firestore so it can be tested on its own; store.ts holds the
   one document per person. */

/** Thread key → sort_at of the newest incoming message seen in it. */
export type Seen = Record<string, string>;

export type ReadMessage = ThreadMessage & { unread?: boolean };

export type ReadThread = Omit<Thread, "messages"> & {
  /** Incoming messages this person has not seen. Our own mail is never unread. */
  unread: number;
  messages: ReadMessage[];
};

export function withReads(threads: Thread[], seen: Seen): ReadThread[] {
  return threads.map((t) => {
    const through = seen[t.key] ?? "";
    let unread = 0;
    const messages = t.messages.map((m): ReadMessage => {
      if (m.dir !== "in" || m.sort_at <= through) return m;
      unread += 1;
      return { ...m, unread: true };
    });
    return { ...t, messages, unread };
  });
}

/** One entry per thread: a time to mark it read through, or null to mark it
    unread again. */
export type ReadMark = { key: string; through: string | null };

/** Applies marks to what was seen. Read never moves backwards — two tabs
    marking the same thread must not undo each other — and unread forgets the
    thread entirely, which makes every incoming message in it new again, as
    Gmail's "mark as unread" does. */
export function applyMarks(seen: Seen, marks: ReadMark[]): Seen {
  const next = { ...seen };
  for (const { key, through } of marks) {
    if (through === null) delete next[key];
    else if (!next[key] || through > next[key]!) next[key] = through;
  }
  return next;
}
