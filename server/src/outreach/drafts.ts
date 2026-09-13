import { randomUUID } from "node:crypto";
import { editorHtml } from "./render.js";
import type { MailDraft } from "./schemas.js";

/* Changing a draft, as a rule rather than as a lump of code inside a tool.

   The composer writes a draft whole — it always has every field on screen —
   but the agent writes one field at a time: "make the subject shorter" must
   not blank the body it never mentioned. So a save from the agent is a patch,
   and this is what it leaves behind. Pure, so the rule can be read and
   checked without Firestore in the way. */

/** The fields an agent may set. Absent means "leave it as it was". */
export type DraftPatch = {
  to?: string[] | null; cc?: string[] | null; bcc?: string[] | null;
  subject?: string | null; body?: string | null;
  /** Only ever used when there is nothing to patch — see below. */
  answers_conversation?: string | null;
};

export function mergedDraft(
  existing: MailDraft | null, patch: DraftPatch, author: string, now: string,
): MailDraft {
  return {
    id: existing?.id ?? randomUUID(),
    author,
    /* A draft belongs to the conversation it was started in, for good.
       Moving one under a different thread would make it answer something it
       does not quote, and the quoting is decided when it is sent. */
    reply_to: existing ? existing.reply_to : patch.answers_conversation ?? null,
    to: patch.to ?? existing?.to ?? [],
    cc: patch.cc ?? existing?.cc ?? [],
    bcc: patch.bcc ?? existing?.bcc ?? [],
    subject: patch.subject ?? existing?.subject ?? "",
    body: patch.body ?? existing?.body ?? "",
    /* Both halves or neither. The composer renders the HTML and only looks
       at the text to decide whether there is anything to send, so a draft
       saved with text and no HTML opens as an empty box with the Send button
       lit — worse than either half being missing on its own. */
    html: patch.body != null ? editorHtml(patch.body) : existing?.html ?? null,
    // Whoever started it chose these, or nobody has yet.
    from_domain: existing?.from_domain ?? null,
    signature: existing?.signature ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}
