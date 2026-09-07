import { useEffect, useRef, useState } from "react";
import { Section, Grid, Cell as GridCell, Stat, Note, H1, Chip, Logo } from "../../../ui";
import {
  cancelSend, clearThread, runTick, sendChat, useHeatmap, useOutreachStatus, useQueue,
  useReplies, useThread, type Cell, type HeatRow,
} from "../../../lib/outreachStore";

/** Heat, 0–1, from how much an account got in one week. Deliberately not
    linear: the difference between nothing and one message matters far more
    than the difference between four and five, and a linear ramp hides it. */
function heat(c: Cell): number {
  const n = c.sent + c.planned;
  if (n === 0) return 0;
  return Math.min(1, 0.28 + Math.log2(n + 1) / 4.2);
}

function HeatCell({ c, week, company }: { c: Cell; week: string; company: string }) {
  const n = c.sent + c.planned;
  const parts = [
    n ? `${c.sent} sent` : "nothing sent",
    c.planned ? `${c.planned} queued` : "",
    c.replies ? `${c.replies} replied` : "",
    c.bounces ? `${c.bounces} bounced` : "",
  ].filter(Boolean);
  const tone = c.bounces ? "var(--hot)" : c.replies ? "var(--calm)" : "var(--cool)";
  return (
    <td className="cell of-heat">
      <span
        className={`of-heat__c${c.replies ? " has-reply" : ""}`}
        style={{ background: n ? tone : "transparent", opacity: n ? heat(c) : 1 }}
        title={`${company} — week of ${week}: ${parts.join(", ")}`}
      />
    </td>
  );
}

/** The operator agent. Everything this panel used to need buttons for —
    drafting, scheduling, cancelling, asking who is overdue — is asked for in
    words here, and the tables below are what happened. The transcript lives
    in this component, so it is per-session by design: no history to manage,
    and no stale conversation to inherit. */
function Operator({ enabled, onAct }: { enabled: boolean; onAct: () => void }) {
  const thread = useThread();
  const [pending, setPending] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const log = useRef<HTMLDivElement | null>(null);
  const turns = thread.data?.turns ?? [];

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [turns.length, busy]);

  const ask = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setPending(text);   // shown immediately; the server owns the real thread
    setBusy(true);
    setError(null);
    try {
      await sendChat(text);
      await thread.reload();
      // The agent may have scheduled or cancelled something, so the state
      // views below are stale the moment it answers.
      onAct();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const forget = async () => {
    setBusy(true);
    try {
      await clearThread();
      await thread.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section kicker="Ask">
      {!enabled && (
        <Note style={{ marginBottom: 12 }}>
          <strong>The agent is not running. </strong>
          <code>GOOGLE_API_KEY</code> is not set on the server, so there is nothing to talk to.
          Everything below still works.
        </Note>
      )}
      <div className="of-chat">
        <div className="of-chat__log" ref={log}>
          {turns.length === 0 && (
            <p className="of-note">
              Ask for what you want. “Who at Bernhard Schulte have we not written to?” ·
              “Draft round 2 for the Pacific Basin fleet people” · “What is left today?” ·
              “Cancel the one to Ana”. It will show you a message before it schedules anything.
            </p>
          )}
          {turns.map((m) => (
            <div key={`${m.at}-${m.role}`} className={`of-chat__m is-${m.role}`}>{m.content}</div>
          ))}
          {pending && <div className="of-chat__m is-user">{pending}</div>}
          {busy && <div className="of-chat__m is-assistant of-note">thinking…</div>}
        </div>
        <div className="of-chat__bar">
          <textarea
            className="of-chat__in" rows={2} value={input} disabled={!enabled || busy}
            placeholder={enabled ? "Ask the agent…" : "unavailable — no model key"}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); }
            }}
          />
          <button className="of-facet__b" disabled={!enabled || busy || !input.trim()}
                  onClick={() => void ask()}>
            {busy ? "…" : "Send"}
          </button>
          {turns.length > 0 && (
            <button className="of-facet__b" disabled={busy} title="Clear the shared thread"
                    onClick={() => void forget()}>Clear</button>
          )}
        </div>
      </div>
      {error && <Note style={{ marginTop: 12 }}>{error}</Note>}
    </Section>
  );
}

export function CrmOutreach() {
  const [weeks, setWeeks] = useState(12);
  const status = useOutreachStatus();
  const map = useHeatmap(weeks);
  const queue = useQueue();
  const replies = useReplies();
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  const s = status.data;

  const doCancel = async (id: string) => {
    setBusy(id);
    try {
      const r = await cancelSend(id);
      setSaid(r.note);
      await Promise.all([queue.reload(), map.reload(), status.reload()]);
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const doTick = async () => {
    setBusy("tick");
    try {
      const r = await runTick();
      setSaid(`${r.due} due, ${r.scheduled} scheduled, ${r.replies} replies in, ` +
              `${r.events} events, ${r.ms}ms${r.blocked.length ? ` — blocked: ${r.blocked.join(", ")}` : ""}`);
      await Promise.all([queue.reload(), map.reload(), replies.reload(), status.reload()]);
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  // Until the keys and domains arrive this whole panel is a status page, and
  // it should say so plainly rather than showing an empty grid.
  if (status.error) {
    return (
      <>
        <H1>Outreach</H1>
        <Note>
          <strong>The outreach API is not answering. </strong>{status.error}
          <br />
          Nothing is broken and nothing has been sent — the engine refuses to send until it is
          configured, and it lists what is missing on the status call.
        </Note>
      </>
    );
  }

  const rows = map.data?.rows ?? [];
  const axis = map.data?.weeks ?? [];
  const totals = map.data?.totals;

  return (
    <>
      <H1>Outreach</H1>
      <p className="of-lede">
        Ask the agent for what you want; the tables are what happened. It drafts, schedules and
        cancels, but it shows you a message before scheduling it, and nothing leaves without a slot
        inside the day's cap for its sending domain.
      </p>

      {s && s.blockers.length > 0 && (
        <Note style={{ marginBottom: 16 }}>
          <strong>Not sending. </strong>
          {s.blockers.length === 1 ? "One thing is" : `${s.blockers.length} things are`} in the way:
          <ul style={{ margin: "8px 0 0 18px" }}>
            {s.blockers.map((b) => <li key={b.code}><code>{b.code}</code> — {b.detail}</li>)}
          </ul>
        </Note>
      )}

      {said && <Note style={{ marginBottom: 16 }}>{said}</Note>}

      <Operator
        enabled={Boolean(s?.configured.model)}
        onAct={() => { void queue.reload(); void map.reload(); void status.reload(); void replies.reload(); }}
      />

      <Section kicker="Today">
        <Grid cols={4}>
          <GridCell><Stat value={totals?.sent ?? 0} label="messages sent" sub={`last ${weeks} weeks`} /></GridCell>
          <GridCell><Stat value={totals?.planned ?? 0} label="queued or drafted" /></GridCell>
          <GridCell><Stat value={totals?.replies ?? 0} label="human replies" /></GridCell>
          <GridCell>
            <Stat value={`${totals?.accounts_touched ?? 0}`} label="accounts touched"
                  sub={`of ${totals?.accounts ?? 0}`} />
          </GridCell>
        </Grid>

        {s && s.domains.length > 0 ? (
          <div className="of-quota">
            {s.domains.map((d) => (
              <div key={d.domain} className="of-quota__row">
                <span className="of-quota__name">{d.domain}</span>
                <span className="of-quota__bar" title={`${d.used} of ${d.cap} used on ${d.day}`}>
                  {Array.from({ length: d.cap }, (_, i) => (
                    <span key={i} className={`of-quota__pip${i < d.used ? " is-used" : ""}`} />
                  ))}
                </span>
                <span className="of-quota__n">{d.left} left today</span>
              </div>
            ))}
          </div>
        ) : (
          <Note style={{ marginTop: 14 }}>
            No sending domain is configured yet. Each one gets its own daily cap — 15 by default —
            and a message is only ever scheduled against a domain that has room.
          </Note>
        )}

        <div className="of-heartbeat">
          <button className="of-facet__b" disabled={busy !== null} onClick={() => void doTick()}>
            {busy === "tick" ? "running…" : "Run a heartbeat now"}
          </button>
          {s?.last_tick ? (
            <span className="of-note">
              last beat {new Date(s.last_tick.at).toLocaleString()} — {s.last_tick.due} due,{" "}
              {s.last_tick.sent} scheduled, {s.last_tick.replies} in, {s.last_tick.ms}ms
              {s.last_tick.error ? ` (${s.last_tick.error})` : ""}
            </span>
          ) : (
            <span className="of-note">no heartbeat has run yet</span>
          )}
          {s && <Chip tone={s.dry_run ? "warm" : "calm"}>{s.dry_run ? "dry run" : "live"}</Chip>}
          {s && <Chip tone={s.auto_followups ? "cool" : ""}>
            {s.auto_followups ? "auto follow-ups on" : "follow-ups need a person"}
          </Chip>}
        </div>
      </Section>

      <Section kicker="Heat by account">
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[8, 12, 26, 52].map((w) => (
            <button key={w} className={`of-facet__b${weeks === w ? " is-on" : ""}`}
                    onClick={() => setWeeks(w)}>{w} weeks</button>
          ))}
        </div>

        <div className="of-matrix-wrap">
          <table className="of-matrix of-crm">
            <thead>
              <tr>
                <th className="co">Account</th>
                {axis.map((w) => (
                  <th key={w} className="of-heat__h" title={`week of ${w}`}>{w.slice(5)}</th>
                ))}
                <th>Sent</th><th>In</th><th>Last</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: HeatRow) => (
                <tr key={r.account_id}>
                  <td className="co">
                    {r.url || r.linkedin_url ? (
                      <a className="co-row" href={r.url ?? r.linkedin_url ?? "#"}
                         target="_blank" rel="noopener noreferrer">
                        <Logo url={r.url} name={r.company} />
                        <span className="co-name">{r.company}</span>
                      </a>
                    ) : (
                      <span className="co-row">
                        <Logo url={null} name={r.company} />
                        <span className="co-name">{r.company}</span>
                      </span>
                    )}
                    <span className="co-sub">tier {r.tier} · {r.contacts} people</span>
                  </td>
                  {r.cells.map((c, i) => (
                    <HeatCell key={axis[i] ?? i} c={c} week={axis[i] ?? ""} company={r.company} />
                  ))}
                  <td className="val">{r.total.sent || ""}</td>
                  <td className="val">
                    {r.total.replies ? <Chip tone="calm">{r.total.replies}</Chip> : ""}
                    {r.total.bounces ? <Chip tone="hot">{r.total.bounces}</Chip> : ""}
                  </td>
                  <td className="cell"><span className="of-note">{r.last_sent ?? "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note style={{ marginTop: 14 }}>
          One column per week, most recent on the right. Blue is volume, green means somebody
          replied that week, red means something bounced. An account with a long blank run is one
          nobody is working; a dark run is one being worked too hard.
        </Note>
      </Section>

      <Section kicker="Scheduled — still cancellable">
        {queue.data?.records.length ? (
          <div className="of-matrix-wrap">
            <table className="of-matrix of-crm">
              <thead>
                <tr>
                  <th className="co">To</th><th>Company</th><th>R</th><th>Subject</th>
                  <th>Domain</th><th>Lands</th><th>Token</th><th></th>
                </tr>
              </thead>
              <tbody>
                {queue.data.records.map((q) => (
                  <tr key={q.id}>
                    <td className="co"><span className="co-name">{q.to_email}</span></td>
                    <td className="cell">{q.company ?? "—"}</td>
                    <td className="val">{q.round}</td>
                    <td className="cell" title={q.subject}>{q.subject.slice(0, 60)}</td>
                    <td className="cell"><span className="of-note">{q.from_domain}</span></td>
                    <td className="cell">
                      {q.scheduled_at ? new Date(q.scheduled_at).toLocaleString() : "—"}
                      {q.dry_run && <> <Chip tone="warm">dry run</Chip></>}
                    </td>
                    <td className="cell">
                      <span className="of-note" title={q.resend_id ?? "never handed to Resend"}>
                        {q.resend_id ? `${q.resend_id.slice(0, 8)}…` : "—"}
                      </span>
                    </td>
                    <td className="cell">
                      <button className="of-rnd" style={{ width: "auto", padding: "0 8px" }}
                              disabled={busy !== null || q.status !== "scheduled"}
                              title={q.status === "scheduled"
                                ? "pull this back before it goes"
                                : `this message is ${q.status}`}
                              onClick={() => void doCancel(q.id)}>
                        {busy === q.id ? "…" : "cancel"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Note>Nothing is queued. A scheduled message stays cancellable right up until it goes —
            that is what the token in this table is for.</Note>
        )}
      </Section>

      <Section kicker="Incoming">
        {replies.data?.records.length ? (
          <div className="of-matrix-wrap">
            <table className="of-matrix of-crm">
              <thead>
                <tr><th className="co">From</th><th>Subject</th><th>When</th><th>What</th></tr>
              </thead>
              <tbody>
                {replies.data.records.map((r) => (
                  <tr key={r.id}>
                    <td className="co"><span className="co-name">{r.from_email}</span></td>
                    <td className="cell" title={r.excerpt ?? ""}>{(r.subject ?? "—").slice(0, 70)}</td>
                    <td className="cell"><span className="of-note">
                      {new Date(r.received_at).toLocaleString()}</span></td>
                    <td className="cell">
                      {r.unsubscribe ? <Chip tone="hot">opted out</Chip>
                        : r.automated ? <Chip tone="warm">automated</Chip>
                        : <Chip tone="calm">reply</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Note>
            Nothing has come back yet. Replies are collected by polling Resend on every heartbeat —
            an opt-out suppresses the address immediately, an out-of-office is logged but does not
            count as a reply, and a real reply ends that person's sequence.
          </Note>
        )}
      </Section>
    </>
  );
}
