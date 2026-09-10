import { draft, modelConfigured } from "./agent.js";
import { enrichCampaign, type CampaignEnrichment } from "./apollo.js";
import { blockers } from "./config.js";
import * as crm from "./crm.js";
import { cancel, Refused, schedule } from "./send.js";
import { allSends } from "./store.js";
import type { Campaign, OutreachConfig } from "./schemas.js";

/* Switching a campaign on: buy the addresses, write round 1 to everybody, and
   put it all in the queue.

   This is the loudest thing in the system — one click and six strangers get
   mail — so read what protects it before changing anything.

   Nothing is *sent* here. Every message is scheduled, paced by nextSlot()
   inside the sending window and charged against the domain's daily cap, and
   every one of them can be cancelled from the queue right up until it goes.
   That is the safety property that makes activation a reasonable button
   rather than a reckless one: it is undoable for as long as it matters.

   The rules that still apply, because they live in schedule() and not here:
   the daily cap, the dry-run switch, the bounced-address check and the
   {{placeholder}} check. A campaign that would exceed the cap stops at the
   cap and says so; it does not spill onto another domain or another day. */

export type Started = {
  enrichment: CampaignEnrichment;
  queued: number;
  /** People we could not write to, and why — one line each, so a partial run
      is legible rather than a number that does not add up. */
  skipped: { contact_id: string; name: string; why: string }[];
  first_lands: string | null;
  stopped: string | null;
};

export async function startCampaign(c: Campaign, cfg: OutreachConfig): Promise<Started> {
  const stops = blockers(cfg);
  if (stops.length) {
    throw new Refused("blocked",
      `Cannot start: ${stops.map((s) => s.detail).join(" ")}`);
  }

  // Addresses first: the whole point of doing this at activation is that the
  // queue that follows is not full of holes.
  const enrichment = await enrichCampaign(c.account_ids);

  const people = (await crm.contacts()).filter(
    (p) => p.account_id && c.account_ids.includes(p.account_id));
  const sends = await allSends();
  const out: Started = { enrichment, queued: 0, skipped: [], first_lands: null, stopped: null };

  for (const p of people) {
    const skip = (why: string) =>
      out.skipped.push({ contact_id: p.id, name: p.full_name, why });

    if (!p.email) { skip("no address — Apollo could not find one"); continue; }
    // Idempotent: activating twice must not write to anyone twice. The check
    // is for a live round 1, so a cancelled one can be re-queued.
    if (sends.some((s) => s.contact_id === p.id && s.round === 1 && s.status !== "canceled")) {
      skip("already had round 1"); continue;
    }

    try {
      const written = await draft(p.id, 1, cfg,
                                  { useModel: modelConfigured(), guidance: c.persona });
      if (written.unresolved.length) {
        skip(`the message still has ${written.unresolved.join(", ")} in it`); continue;
      }
      const r = await schedule({
        contact_id: p.id, to: null, round: 1,
        subject: written.subject, body: written.body,
        scheduled_at: null, domain: null,
        written_by: modelConfigured() ? "agent" : "template",
        template_tier: written.template_tier,
        signature: null,
        in_reply_to: null, references: [],
      }, cfg, sends);

      // Kept in step so the next message is paced after this one rather than
      // all of them landing on the same slot.
      sends.push({ ...(await allSends()).find((s) => s.id === r.id)! });
      out.queued++;
      if (!out.first_lands || r.scheduled_at < out.first_lands) out.first_lands = r.scheduled_at;
    } catch (e) {
      if (e instanceof Refused && (e.code === "cap-reached" || e.code === "no-domain-with-room")) {
        out.stopped = `${e.message} The rest stay unqueued and can be started again tomorrow.`;
        break;
      }
      skip(e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}

/* Switching a campaign off, and meaning it.

   Pausing sets `active: false` and stops there — anything already in the
   queue still goes. That is usually right: you paused because you want to
   think, not because the six messages you already approved became wrong.

   Ending is the other answer. It pauses *and* pulls back everything of this
   campaign's that has not gone yet, which is the thing you want when the
   campaign itself was the mistake. There is no third state stored for it:
   an ended campaign is a paused one with an empty queue, and inventing an
   `ended` flag would be a second source of truth about the same fact.

   Round 0 is deliberately spared. Those are one-offs somebody wrote by hand
   to a person who happens to sit at one of these accounts, and they are not
   the campaign's to cancel. */
export type Ended = {
  canceled: number;
  /** Messages that refused to cancel — already sent, or Resend said no. Kept
      as a count rather than swallowed, so "ended" never overstates itself. */
  failed: number;
};

export async function endCampaign(c: Campaign): Promise<Ended> {
  const queued = (await allSends()).filter(
    (s) => s.account_id && c.account_ids.includes(s.account_id)
        && s.round !== 0
        && (s.status === "scheduled" || s.status === "draft"));
  let canceled = 0, failed = 0;
  for (const row of queued) {
    // One at a time and never throwing: a message that cannot be pulled back
    // must not strand the twenty behind it that can.
    try { await cancel(row.id); canceled++; } catch { failed++; }
  }
  return { canceled, failed };
}
