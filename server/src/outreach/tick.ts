import { draft, modelConfigured } from "./agent.js";
import { blockers, secret } from "./config.js";
import { pollEvents, pollReplies } from "./poll.js";
import { Refused, schedule } from "./send.js";
import { allReplies, allSends, getConfig, recordTick, type Tick } from "./store.js";
import type { OutreachConfig, SendRecord } from "./schemas.js";

/* The heartbeat.

   Cloud Scheduler calls this once a minute. It is deliberately the only thing
   here with a clock: Mastra can run its own cron, but that needs a process
   that never sleeps, and keeping one warm costs more per month than this
   whole subsystem is worth. Cloud Run scales to zero between beats and GCP
   holds the clock.

   Everything is idempotent. A beat that runs twice, or two that overlap
   because one was slow, must not send anything twice — hence the check for a
   round that already has a record, and hence the cap living in a transaction
   rather than in this file. */

export type Due = {
  contact_id: string; account_id: string | null; company: string | null;
  next_round: 1 | 2 | 3; last_at: string;
};

/** Who is owed a follow-up: a message landed, the cadence has elapsed, nobody
    replied, and the next round has not already been written. */
export function due(
  cfg: OutreachConfig, sends: SendRecord[], replies: { contact_id: string | null; automated: boolean }[],
  now = Date.now(),
): Due[] {
  const answered = new Set(replies.filter((r) => !r.automated).map((r) => r.contact_id));
  const landed = new Set(["sent", "delivered", "opened", "clicked"]);
  const out: Due[] = [];

  const byContact = new Map<string, SendRecord[]>();
  for (const s of sends) {
    if (!s.contact_id) continue;
    byContact.set(s.contact_id, [...(byContact.get(s.contact_id) ?? []), s]);
  }

  for (const [contactId, group] of byContact) {
    if (answered.has(contactId)) continue;
    const live = group.filter((s) => s.status !== "canceled");
    // round 0 is a one-off written by hand — it is not part of the sequence,
    // so it neither advances the cadence nor starts one.
    const last = live.filter((s) => s.round >= 1 && !s.dry_run && landed.has(s.status))
      .sort((a, b) => (b.scheduled_at ?? b.created_at).localeCompare(a.scheduled_at ?? a.created_at))[0];
    if (!last || last.round >= 3) continue;

    const next = (last.round + 1) as 1 | 2 | 3;
    if (live.some((s) => s.round === next)) continue;

    const waited = cfg.cadence_days[last.round === 1 ? "round_2" : "round_3"];
    const at = new Date(last.scheduled_at ?? last.created_at).getTime();
    if (now - at < waited * 86_400_000) continue;

    out.push({ contact_id: contactId, account_id: last.account_id, company: last.company,
               next_round: next, last_at: new Date(at).toISOString() });
  }
  return out.sort((a, b) => a.last_at.localeCompare(b.last_at));
}

export async function tick(): Promise<Tick> {
  const started = Date.now();
  const notes: string[] = [];
  const cfg = await getConfig();
  const stops = blockers(cfg);
  let replies = 0;
  let events = 0;
  let scheduled = 0;

  const say = (e: unknown, what: string) =>
    notes.push(`${what}: ${e instanceof Error ? e.message : String(e)}`);

  // Polling is worth doing even when sending is blocked — a reply to an
  // earlier campaign still has to reach the CRM.
  if (secret("RESEND_API_KEY")) {
    try { events = await pollEvents(); } catch (e) { say(e, "events"); }
    try { replies = await pollReplies(); } catch (e) { say(e, "replies"); }
  } else {
    notes.push("no RESEND_API_KEY — polling skipped");
  }

  const sends = await allSends();
  const owed = due(cfg, sends, await allReplies());

  if (cfg.auto_followups && stops.length === 0) {
    for (const d of owed) {
      try {
        const prior = sends.filter((s) => s.contact_id === d.contact_id && s.status !== "canceled");
        const written = await draft(d.contact_id, d.next_round, cfg,
                                    { useModel: modelConfigured(), prior });
        if (written.unresolved.length) {
          notes.push(`${d.contact_id} r${d.next_round}: unresolved ${written.unresolved.join(",")}`);
          continue;
        }
        await schedule({
          contact_id: d.contact_id, to: null, round: d.next_round,
          subject: written.subject, body: written.body,
          scheduled_at: null, domain: null,
          written_by: modelConfigured() ? "agent" : "template",
          template_tier: written.template_tier,
          signature: null,   // the configured default
        }, cfg, sends);
        scheduled++;
      } catch (e) {
        // A full domain is the normal end of a day's work, not an error.
        if (e instanceof Refused && (e.code === "cap-reached" || e.code === "no-domain-with-room")) {
          notes.push(`stopped: ${e.message}`);
          break;
        }
        say(e, d.contact_id);
      }
    }
  }

  const result: Tick = {
    at: new Date().toISOString(), due: owed.length, scheduled, replies, events,
    ms: Date.now() - started, blocked: stops.map((s) => s.code), notes,
  };
  await recordTick(result).catch(() => undefined);
  return result;
}
