import { openedAt } from "./sends.js";
import type { AccountRecord } from "../schemas.js";
import type { ReplyRecord } from "./store.js";
import type { SendRecord } from "./schemas.js";

/* How much has each account had, and what came back.

   The point is not decoration. Cold outreach fails in two directions and
   both are invisible in a list: accounts that quietly get nothing for months,
   and accounts hit three times in a fortnight by two different people. A grid
   of account against week shows both at a glance.

   Grouping happens in memory. A few hundred documents a year is nowhere near
   enough work to justify a database that can GROUP BY.

   Counts whatever it is handed, and loads nothing itself — which is what
   makes it checkable against fixtures. The route hands it marketing mail
   only: see isMarketing, and the route's own note on why a hand-written
   one-off is not a thing this grid is asking about. */

export type Cell = {
  sent: number; planned: number; replies: number; bounces: number;
  /** How many of that week's messages were opened. Counted against the week
      the message landed, not the week it was read: the question this grid
      answers is what each week's mail achieved. */
  opens: number;
};
export type HeatRow = {
  account_id: string; company: string; tier: number; url: string | null;
  linkedin_url: string | null; status: string; contacts: number;
  cells: Cell[]; total: Cell; last_sent: string | null;
};

const SENT = new Set(["sent", "delivered", "opened", "clicked", "bounced", "complained"]);
const BOUNCED = new Set(["bounced", "complained"]);

/** Monday of the week containing `d`, as YYYY-MM-DD. */
function monday(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

/** The last `weeks` week-start dates, oldest first, ending with this week. */
export function weekAxis(weeks: number, now = new Date()): string[] {
  const end = new Date(`${monday(now)}T00:00:00Z`);
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - (weeks - 1 - i) * 7);
    return d.toISOString().slice(0, 10);
  });
}

const empty = (): Cell => ({ sent: 0, planned: 0, replies: 0, bounces: 0, opens: 0 });
const busy = (c: Cell) => c.sent + c.planned + c.replies + c.bounces > 0;

/** How far past this week the axis may run for mail already queued. A guard
    against one bad date stretching the grid by years, not a real limit. */
const AHEAD = 26;

export function heatmap(
  accounts: AccountRecord[], sends: SendRecord[], replies: ReplyRecord[],
  weeks = 12, now = new Date(),
) {
  // Back `weeks` from this week, and forward to the last week anything queued
  // is due to land — a follow-up booked for next Tuesday belongs on the grid.
  let ahead = 0;
  const thisWeek = new Date(`${monday(now)}T00:00:00Z`).getTime();
  for (const s of sends) {
    if (s.status === "canceled") continue;
    const w = new Date(`${monday(new Date(s.scheduled_at ?? s.created_at))}T00:00:00Z`).getTime();
    ahead = Math.max(ahead, Math.min(AHEAD, Math.round((w - thisWeek) / (7 * 86_400_000))));
  }
  const axis = weekAxis(weeks + ahead, new Date(thisWeek + ahead * 7 * 86_400_000));
  const col = new Map(axis.map((w, i) => [w, i]));

  const rows: HeatRow[] = accounts.map((a) => ({
    account_id: a.id, company: a.company, tier: a.tier, url: a.url,
    linkedin_url: a.linkedin_url, status: a.status, contacts: a.contacts.length,
    cells: axis.map(empty), total: empty(), last_sent: null,
  }));
  const byId = new Map(rows.map((r) => [r.account_id, r]));

  const bump = (id: string | null, when: string, key: keyof Cell) => {
    const row = id ? byId.get(id) : undefined;
    const i = col.get(monday(new Date(when)));
    if (!row || i === undefined) return;
    row.cells[i]![key]++;
    row.total[key]++;
  };

  for (const s of sends) {
    if (s.status === "canceled") continue;
    // A send counts in the week it is due to land, not the week it was
    // written: queued on Friday for Tuesday belongs to Tuesday.
    const when = s.scheduled_at ?? s.created_at;
    if (s.dry_run || s.status === "scheduled" || s.status === "draft") bump(s.account_id, when, "planned");
    if (!s.dry_run && SENT.has(s.status)) {
      bump(s.account_id, when, "sent");
      if (openedAt(s)) bump(s.account_id, when, "opens");
      const row = s.account_id ? byId.get(s.account_id) : undefined;
      const day = when.slice(0, 10);
      if (row && (!row.last_sent || day > row.last_sent)) row.last_sent = day;
    }
    if (BOUNCED.has(s.status)) bump(s.account_id, when, "bounces");
  }
  for (const r of replies) if (!r.automated) bump(r.account_id, r.received_at, "replies");

  const totals = rows.reduce((a, r) => ({
    sent: a.sent + r.total.sent, planned: a.planned + r.total.planned,
    replies: a.replies + r.total.replies, bounces: a.bounces + r.total.bounces,
    opens: a.opens + r.total.opens,
    accounts_touched: a.accounts_touched + (r.total.sent + r.total.planned > 0 ? 1 : 0),
    accounts: rows.length,
  }), { ...empty(), accounts_touched: 0, accounts: rows.length });

  rows.sort((a, b) =>
    b.total.sent + b.total.planned - (a.total.sent + a.total.planned)
    || a.tier - b.tier || a.company.localeCompare(b.company));

  // A week nobody was sent anything in is a column of empty squares that
  // pushes the weeks that matter off the right edge. Drop it.
  const keep = axis.map((_, i) => rows.some((r) => busy(r.cells[i]!)));
  for (const r of rows) r.cells = r.cells.filter((_, i) => keep[i]);

  return { weeks: axis.filter((_, i) => keep[i]), rows, totals };
}
