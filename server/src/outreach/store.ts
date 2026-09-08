import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebaseApp.js";
import { OutreachConfig, type Campaign, type SendRecord, type SendStatus } from "./schemas.js";
import { dayKey } from "./time.js";

/* Everything the outreach engine persists, in the CRM's own Firestore.

   There is no second database. The volumes here are a dozen messages a day
   against thirty-eight accounts, which is small enough that the reports are
   built by reading the documents and grouping them in memory — cheaper in
   every sense than running a SQL instance to do a GROUP BY. */

const SENDS = "crmSends";
const QUOTA = "crmQuota";
const REPLIES = "crmReplies";
const TICKS = "crmTicks";
const META = "crmOutreachMeta";
const CAMPAIGNS = "crmCampaigns";

// ---- Config ---------------------------------------------------------------

/** Defaults are deliberately unsendable — no domains, dry_run on, no postal
    address — so a fresh deployment cannot email anyone by accident. */
export async function getConfig(): Promise<OutreachConfig> {
  const snap = await db().collection(META).doc("config").get();
  return OutreachConfig.parse(snap.exists ? snap.data() : {});
}

export async function putConfig(patch: Partial<OutreachConfig>): Promise<OutreachConfig> {
  // Only the keys the caller actually sent. A partial parse can hand back
  // keys whose value is undefined, and spreading those blanks a configured
  // field — the schema default then quietly replaces it. That is how saving
  // a signature from the settings page erased every sending domain, the
  // postal address and the opt-out mailbox in one write.
  const given = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined));
  const merged = OutreachConfig.parse({
    ...(await getConfig()), ...given, updated: new Date().toISOString(),
  });
  await db().collection(META).doc("config").set(merged);
  return merged;
}

// ---- The daily cap --------------------------------------------------------

/** Claims one slot on `domain` for `day`. Returns the new count, or null when
    the cap is already reached.

    This is the one place that genuinely needs a transaction. Two requests
    that both read 14 must not both write 15: exceeding the cap on a young
    sending domain is what gets a domain filed as spam, and that is not
    reversible on any useful timescale. Firestore transactions are
    serializable and retry on contention, so the read-check-write holds. */
export async function reserve(domain: string, day: string, cap: number): Promise<number | null> {
  if (cap < 1) return null;
  const ref = db().collection(QUOTA).doc(`${domain}__${day}`);
  return db().runTransaction(async (t) => {
    const snap = await t.get(ref);
    const used = snap.exists ? Number(snap.data()?.used ?? 0) : 0;
    if (used >= cap) return null;
    t.set(ref, { domain, day, cap, used: used + 1 }, { merge: true });
    return used + 1;
  });
}

/** Hands a slot back, when a scheduled message is cancelled or Resend rejects
    one we had already counted. */
export async function release(domain: string, day: string): Promise<void> {
  const ref = db().collection(QUOTA).doc(`${domain}__${day}`);
  await db().runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return;
    t.update(ref, { used: Math.max(0, Number(snap.data()?.used ?? 0) - 1) });
  });
}

export type Headroom = { domain: string; day: string; used: number; cap: number; left: number };

/** What each enabled domain has left today. Reads only; claims nothing. */
export async function headroom(cfg: OutreachConfig, at = new Date()): Promise<Headroom[]> {
  const day = dayKey(at, cfg.timezone);
  const enabled = cfg.domains.filter((d) => d.enabled);
  return Promise.all(enabled.map(async (d) => {
    const snap = await db().collection(QUOTA).doc(`${d.domain}__${day}`).get();
    const used = snap.exists ? Number(snap.data()?.used ?? 0) : 0;
    const cap = d.daily_cap ?? cfg.default_daily_cap;
    return { domain: d.domain, day, used, cap, left: Math.max(0, cap - used) };
  }));
}

/** The domain the automation should use next: the one with the most room
    left today, ignoring anything reserved for hand-written mail. Spreading
    across domains rather than draining one keeps each domain's daily volume
    flat, which is what warming wants. */
export async function pickDomain(cfg: OutreachConfig, at = new Date()): Promise<Headroom | null> {
  const manual = new Set(cfg.domains.filter((d) => d.manual_only).map((d) => d.domain));
  const open = (await headroom(cfg, at)).filter((r) => r.left > 0 && !manual.has(r.domain));
  open.sort((a, b) => b.left - a.left);
  return open[0] ?? null;
}

// ---- Sends ----------------------------------------------------------------

export const putSend = (r: SendRecord): Promise<unknown> =>
  db().collection(SENDS).doc(r.id).set(r);

export async function getSend(id: string): Promise<SendRecord | null> {
  const snap = await db().collection(SENDS).doc(id).get();
  return snap.exists ? (snap.data() as SendRecord) : null;
}

export async function setStatus(
  id: string, status: SendStatus,
  extra: Partial<Pick<SendRecord, "last_event" | "error" | "message_id">> = {},
): Promise<void> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(extra)) if (v != null) patch[k] = v;
  await db().collection(SENDS).doc(id).update(patch);
}

/** Every send, newest first. Thirty-eight accounts times three rounds is a
    few hundred documents a year — small enough to read whole and filter in
    memory, which is why there are no composite indexes to maintain. */
export async function allSends(): Promise<SendRecord[]> {
  const snap = await db().collection(SENDS).get();
  return snap.docs
    .map((d) => d.data() as SendRecord)
    .sort((a, b) => (b.scheduled_at ?? b.created_at).localeCompare(a.scheduled_at ?? a.created_at));
}

const TERMINAL = new Set(["canceled", "bounced", "complained", "failed", "clicked"]);

/** Messages Resend has that have not finished, so the poll knows what to ask
    about. */
export const openSends = (sends: SendRecord[]): SendRecord[] =>
  sends.filter((s) => s.resend_id && !TERMINAL.has(s.status));

// ---- Replies --------------------------------------------------------------

export type ReplyRecord = {
  id: string; from: string; subject: string | null; received_at: string;
  send_id: string | null; account_id: string | null; contact_id: string | null;
  excerpt: string | null; unsubscribe: boolean; automated: boolean;
};

export const putReply = (r: ReplyRecord): Promise<unknown> =>
  db().collection(REPLIES).doc(r.id).set(r);

export async function haveReply(id: string): Promise<boolean> {
  return (await db().collection(REPLIES).doc(id).get()).exists;
}

export async function allReplies(): Promise<ReplyRecord[]> {
  const snap = await db().collection(REPLIES).get();
  return snap.docs
    .map((d) => d.data() as ReplyRecord)
    .sort((a, b) => b.received_at.localeCompare(a.received_at));
}

// ---- Heartbeat ------------------------------------------------------------

export type Tick = {
  at: string; due: number; scheduled: number; replies: number; events: number;
  ms: number; blocked: string[]; notes: string[];
};

/** The last beat is always current, and a beat is only kept in the history if
    it actually did something. A minute-by-minute log of "nothing was due"
    would be half a million documents a year to say nothing. */
export async function recordTick(t: Tick): Promise<void> {
  await db().collection(META).doc("lastTick").set(t);
  if (t.scheduled || t.replies || t.events || t.notes.length) {
    await db().collection(TICKS).doc(t.at).set(t);
  }
}

export async function lastTick(): Promise<Tick | null> {
  const snap = await db().collection(META).doc("lastTick").get();
  return snap.exists ? (snap.data() as Tick) : null;
}

export async function recentTicks(limit = 50): Promise<Tick[]> {
  const snap = await db().collection(TICKS).orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((d) => d.data() as Tick);
}

// ---- The operator's thread ------------------------------------------------

export type ChatTurn = { role: "user" | "assistant"; content: string; at: string };

/** One shared conversation for the whole CRM, not one per browser tab.

    Two people are on the allow-list and they are working the same pipeline,
    so a thread each would mean the agent telling one of them about messages
    the other already scheduled. One thread means whoever opens the panel sees
    what was asked and what happened, and the agent has the same continuity
    they do.

    Kept as a single document: a Firestore document holds a megabyte, which is
    hundreds of turns, and reading a conversation should be one read. */
const MAX_TURNS = 80;

export async function getThread(): Promise<ChatTurn[]> {
  const snap = await db().collection(META).doc("thread").get();
  return snap.exists ? ((snap.data()?.turns as ChatTurn[]) ?? []) : [];
}

/** Appends in a transaction so two people typing at once cannot lose each
    other's turns. Returns the whole thread as it now stands. */
export async function appendTurns(turns: ChatTurn[]): Promise<ChatTurn[]> {
  const ref = db().collection(META).doc("thread");
  return db().runTransaction(async (t) => {
    const snap = await t.get(ref);
    const existing = (snap.exists ? (snap.data()?.turns as ChatTurn[]) : []) ?? [];
    const next = [...existing, ...turns].slice(-MAX_TURNS);
    t.set(ref, { turns: next, updated: new Date().toISOString() });
    return next;
  });
}

export const clearThread = (): Promise<unknown> =>
  db().collection(META).doc("thread").set({ turns: [], updated: new Date().toISOString() });

// ---- Campaigns --------------------------------------------------------

export async function allCampaigns(): Promise<Campaign[]> {
  const snap = await db().collection(CAMPAIGNS).get();
  return snap.docs.map((d) => d.data() as Campaign);
}

export async function putCampaign(c: Campaign): Promise<Campaign> {
  await db().collection(CAMPAIGNS).doc(c.id).set(c);
  return c;
}

/** The one place company and persona meet, and only because a campaign
    explicitly lists this account — everywhere else the two stay orthogonal. */
export async function campaignFor(accountId: string | null): Promise<Campaign | null> {
  if (!accountId) return null;
  const list = await allCampaigns();
  return list.find((c) => c.active && c.account_ids.includes(accountId)) ?? null;
}

// ---- Poll cursor ----------------------------------------------------------

export async function getCursor(): Promise<string | null> {
  const snap = await db().collection(META).doc("pollCursor").get();
  return snap.exists ? ((snap.data()?.at as string) ?? null) : null;
}

export const setCursor = (at: string): Promise<unknown> =>
  db().collection(META).doc("pollCursor").set({ at, updated: FieldValue.serverTimestamp() });
