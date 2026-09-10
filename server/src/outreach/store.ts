import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebaseApp.js";
import { OutreachConfig, type Campaign, type SendRecord, type SendStatus } from "./schemas.js";
import { SENDERS } from "./config.js";
import { dayKey } from "./time.js";
import { applyMarks, type ReadMark, type Seen } from "./reads.js";

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
const OPTOUTS = "crmOptOuts";
const READS = "crmReads";

// ---- Config ---------------------------------------------------------------

/** Defaults are deliberately unsendable — no domains, dry_run on, no postal
    address — so a fresh deployment cannot email anyone by accident. */
export async function getConfig(): Promise<OutreachConfig> {
  const snap = await db().collection(META).doc("config").get();
  return OutreachConfig.parse(snap.exists ? snap.data() : {});
}

export async function putConfig(patch: Partial<OutreachConfig>): Promise<OutreachConfig> {
  // Only the keys the caller actually sent. Callers build the patch with
  // configPatch(), which is the part that gets this right; the filter here is
  // a second lock on the same door, because a patch that carries a key it was
  // never given silently erases whatever that key held.
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

export type Headroom = {
  domain: string; day: string; used: number; cap: number; left: number;
  /** Whether the domain is configured and switched on. False rows carry a
      cap of 0, so they have no room and can never be picked. */
  sends: boolean;
};

/** What every domain has left today. Reads only; claims nothing.

    Every domain in SENDERS appears, switched on or not. This feeds the
    Outreach panel, and a domain we own that is not sending should say so
    there rather than be absent from the one list of what we send as — the
    same list Settings shows. Configured domains come first; the rest carry
    a cap of 0, so they have no room and pickDomain can never choose one. */
export async function headroom(cfg: OutreachConfig, at = new Date()): Promise<Headroom[]> {
  const day = dayKey(at, cfg.timezone);
  const enabled = cfg.domains.filter((d) => d.enabled);
  const live = await Promise.all(enabled.map(async (d) => {
    const snap = await db().collection(QUOTA).doc(`${d.domain}__${day}`).get();
    const used = snap.exists ? Number(snap.data()?.used ?? 0) : 0;
    const cap = d.daily_cap ?? cfg.default_daily_cap;
    return { domain: d.domain, day, used, cap, left: Math.max(0, cap - used), sends: true };
  }));
  const idle = SENDERS
    .filter((x) => !enabled.some((d) => d.domain === x.domain))
    .map((x) => ({ domain: x.domain, day, used: 0, cap: 0, left: 0, sends: false }));
  return [...live, ...idle];
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
  /** RFC 5322 Message-ID. A reply quotes this in In-Reply-To/References,
      which is the only thing that makes mail clients thread it. */
  message_id?: string | null;
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

// ---- Opt-outs -------------------------------------------------------------

/** One row per address that has asked to be left alone.

    Resend keeps a suppression list too, and it is still written to — it is
    what actually stops a send at the provider, across every domain and every
    key. This collection is the *record*: who, when, and how they told us.
    Resend's list can be exported but it does not say "clicked the link in
    round 2 on the ninth", and an opt-out you cannot evidence is one you
    cannot defend if somebody complains. It is also the copy send.ts can
    check for itself, without a round trip to Resend, before it uses an
    address for anything. */
export type OptOut = {
  /** Lowercased address. Also the document id, so recording twice is a no-op. */
  email: string;
  contact_id: string | null;
  account_id: string | null;
  /** How they told us: a click, a one-click header POST, a typed reply, or
      somebody adding them by hand from the panel. */
  source: "link" | "one-click" | "reply" | "manual";
  at: string;
  /** Whatever we could see of the request, for the same reason the access log
      exists: an opt-out is a thing people dispute. */
  note: string | null;
  /** How many queued messages were pulled back as a result. */
  canceled: number;
  /** The contact's pipeline status before opting out set it to "dead", so
      opting them back in can put it back instead of guessing. Absent on rows
      written before this was recorded, and on addresses with no contact. */
  prior_status?: string | null;
  /** Set when somebody was deliberately opted back in. The row is kept
      rather than deleted, for the same reason a deleted campaign is kept:
      the evidence that they once asked to be left alone is the whole point
      of this collection, and destroying it to undo it would leave nothing
      to show. A restored row does not suppress sending. */
  restored_at?: string | null;
  restored_note?: string | null;
};

const addrKey = (email: string): string =>
  email.trim().toLowerCase().replace(/\//g, "_");

export async function recordOptOut(o: OptOut): Promise<void> {
  const ref = db().collection(OPTOUTS).doc(addrKey(o.email));
  await db().runTransaction(async (t) => {
    const snap = await t.get(ref);
    const existing = snap.exists ? (snap.data() as OptOut) : null;

    /* Asking again after being opted back in is a NEW opt-out, and has to
       clear the restoration. Merging "seen it before" over a restored row
       would leave somebody who has just asked twice still sendable — the
       worst failure this collection has. */
    if (existing && !existing.restored_at) {
      // First writer wins on the how-and-when: the click that actually opted
      // them out is the event, and a later duplicate must not rewrite it.
      t.set(ref, { seen_again_at: o.at, canceled: o.canceled }, { merge: true });
      return;
    }
    t.set(ref, {
      ...o, email: o.email.trim().toLowerCase(),
      restored_at: null, restored_note: null,
      ...(existing ? { previously_restored_at: existing.restored_at } : {}),
    });
  });
}

/** Undoes an opt-out, deliberately. The row stays, marked — see restored_at.

    Caller's job to lift the suppression at Resend too; this only moves our
    own record, and a row restored here while Resend still suppresses the
    address would be a panel that says one thing and a provider that does
    another. See optOut.ts. */
export async function restoreOptOut(email: string, note: string | null): Promise<OptOut | null> {
  const ref = db().collection(OPTOUTS).doc(addrKey(email));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const at = new Date().toISOString();
  await ref.set({ restored_at: at, restored_note: note }, { merge: true });
  return { ...(snap.data() as OptOut), restored_at: at, restored_note: note };
}

export async function isOptedOut(email: string): Promise<boolean> {
  const snap = await db().collection(OPTOUTS).doc(addrKey(email)).get();
  // A restored row is history, not a live opt-out.
  return snap.exists && !(snap.data() as OptOut).restored_at;
}

/** Everyone who has ever asked, restored rows included — the panel shows
    those too, greyed, because "we opted this person back in on the tenth" is
    exactly the fact somebody will need to explain later. */
export async function allOptOuts(): Promise<OptOut[]> {
  const snap = await db().collection(OPTOUTS).get();
  return snap.docs.map((d) => d.data() as OptOut).sort((a, b) => b.at.localeCompare(a.at));
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

// ---- What each person has read --------------------------------------------

/** One document per person, keyed by sign-in address, holding the whole map:
    the inbox needs all of it every time, so it should be one read. What the
    values mean is in reads.ts. */
export async function getSeen(email: string): Promise<Seen> {
  const snap = await db().collection(READS).doc(email).get();
  return snap.exists ? ((snap.data()?.seen as Seen) ?? {}) : {};
}

/** In a transaction, so two tabs marking at once cannot drop each other's
    marks. Written whole with set(), never update(): thread keys contain dots,
    and update() would read "a@b.com|re x" as a path into nested fields. */
export async function markSeen(email: string, marks: ReadMark[]): Promise<void> {
  const ref = db().collection(READS).doc(email);
  await db().runTransaction(async (t) => {
    const snap = await t.get(ref);
    const seen = (snap.exists ? (snap.data()?.seen as Seen) : {}) ?? {};
    t.set(ref, { seen: applyMarks(seen, marks), updated: new Date().toISOString() });
  });
}

// ---- Campaigns --------------------------------------------------------

export async function allCampaigns(): Promise<Campaign[]> {
  const snap = await db().collection(CAMPAIGNS).get();
  return snap.docs.map((d) => d.data() as Campaign).filter((c) => !c.deleted_at);
}

/** Hides a campaign. A soft delete on purpose: the sends it produced point
    back at it, and a message in somebody's thread whose campaign id resolves
    to nothing is worse than a campaign nobody can see. The row stays, marked;
    `allCampaigns` filters it out, so every reader — the panels, the drafting
    path, the operator's tools — stops seeing it at once. */
export async function deleteCampaign(id: string): Promise<void> {
  await db().collection(CAMPAIGNS).doc(id)
    .set({ deleted_at: new Date().toISOString() }, { merge: true });
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
