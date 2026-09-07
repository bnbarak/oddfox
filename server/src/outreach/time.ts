/** Day boundaries for the daily cap. A "day" has to be a *local* day — a cap
    that rolls over at midnight UTC would let a European morning spill across
    two budgets — so every day key is computed in the configured zone.
    en-CA formats as YYYY-MM-DD, which is why it is used here. */
export function dayKey(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(at);
}

/** The wall-clock hour at `at` in `timeZone`, 0–23. */
export function hourIn(at: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(at);
  return Number(h);
}

/** Moves `at` forward to the next instant inside [start_hour, end_hour) in
    `timeZone`. Already inside the window means unchanged. Steps an hour at a
    time rather than doing zone arithmetic, so DST is the platform's problem,
    not ours; at most 24 iterations. */
export function nextInWindow(at: Date, timeZone: string, startHour: number, endHour: number): Date {
  const t = new Date(at.getTime());
  for (let i = 0; i < 24 * 7; i++) {
    const h = hourIn(t, timeZone);
    if (h >= startHour && h < endHour) return t;
    t.setTime(t.getTime() + 60 * 60 * 1000);
    t.setMinutes(0, 0, 0);
  }
  return t;
}

export const nowIso = (): string => new Date().toISOString();
