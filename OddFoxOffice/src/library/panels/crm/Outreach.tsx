import { useEffect, useState } from "react";
import { Section, Grid, Cell as GridCell, Stat, Note, H1, Chip, Logo } from "../../../ui";
import {
  cancelSend, runTick, sendNow, useCampaigns, useThreads, useHeatmap, useOutreachStatus, useQueue,
  useReplies,
  type Cell, type HeatRow, type Thread,
} from "../../../lib/outreachStore";
import { AccountLink } from "./Account";
import { CampaignChip } from "./CampaignChip";
import { CampaignSequenceModal, SequenceModal } from "./SequenceModal";
import { CRM_CHANGED } from "./Operator";
import { Toast } from "./Toast";

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

export function CrmOutreach() {
  const [weeks, setWeeks] = useState(12);
  const status = useOutreachStatus();
  const map = useHeatmap(weeks);
  const queue = useQueue();
  const campaigns = useCampaigns();

  const replies = useReplies();
  const [busy, setBusy] = useState<string | null>(null);
  const threads = useThreads();
  const [seqCampaign, setSeqCampaign] =
    useState<{ name: string; ids: string[] } | null>(null);
  const [seqPerson, setSeqPerson] = useState<Thread | null>(null);

  const [said, setSaid] = useState<string | null>(null);


  const s = status.data;

  // The agent is docked in the layout, so it cannot call these reloaders
  // directly. It announces instead, and every panel that cares listens.
  useEffect(() => {
    const refresh = () => {
      void queue.reload(); void map.reload(); void status.reload(); void replies.reload();
      void campaigns.reload();
    };
    window.addEventListener(CRM_CHANGED, refresh);
    return () => window.removeEventListener(CRM_CHANGED, refresh);
  }, [queue, map, status, replies, campaigns]);

  const doNow = async (id: string) => {
    setBusy(id);
    try {
      const r = await sendNow(id);
      setSaid(r?.note ?? "on its way");
      await Promise.all([queue.reload(), map.reload(), status.reload()]);
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

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
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <H1>Outreach</H1>
        {s && <Chip tone={s.dry_run ? "warm" : "calm"}>{s.dry_run ? "dry run" : "live"}</Chip>}
      </div>
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
      {/* dry-run is a deliberate state, shown as a tag on the title. Only
          things that are actually missing belong in this list. */}
      {(() => {
        const missing = (s?.blockers ?? []).filter((b) => b.code !== "dry-run");
        if (!missing.length) return null;
        return (
          <Note style={{ marginBottom: 16 }}>
            <strong>Not sending. </strong>
            {missing.length === 1 ? "One thing is" : `${missing.length} things are`} in the way:
            <ul style={{ margin: "8px 0 0 18px" }}>
              {missing.map((b) => <li key={b.code}><code>{b.code}</code> — {b.detail}</li>)}
            </ul>
          </Note>
        );
      })()}

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
                {/* A domain that is not switched on has no quota to draw;
                    an empty bar reading "0 left" would look like a full day. */}
                {d.sends ? (
                  <>
                    <span className="of-quota__bar" title={`${d.used} of ${d.cap} used on ${d.day}`}>
                      {Array.from({ length: d.cap }, (_, i) => (
                        <span key={i} className={`of-quota__pip${i < d.used ? " is-used" : ""}`} />
                      ))}
                    </span>
                    <span className="of-quota__n">{d.left} left today</span>
                  </>
                ) : (
                  <span className="of-note">not sending yet</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Note style={{ marginTop: 14 }}>No sending domain configured.</Note>
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
                <th>Campaign</th>
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
                    <AccountLink id={r.account_id}>
                      <Logo url={r.url} name={r.company} />
                      <span className="co-name">{r.company}</span>
                    </AccountLink>
                    <span className="co-sub">tier {r.tier} · {r.contacts} people</span>
                  </td>
                  <td className="val"><CampaignChip square of={campaigns.data?.states[r.account_id]} /></td>
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
          Blue is volume, green a reply, red a bounce. Newest week on the right.
          The campaign square is green while a campaign is running, blue with mail in the
          queue, amber when paused, grey before it starts — hover it for the name.
        </Note>
      </Section>

      <Section kicker="Scheduled — still cancellable">
        {queue.data?.records.length ? (
          <div className="of-matrix-wrap">
            <table className="of-matrix of-crm">
              <thead>
                <tr>
                  <th className="co">To</th><th>Company</th><th>R</th><th>Subject</th>
                  <th>Domain</th><th>Lands</th><th>Token</th><th></th><th></th>
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
                      {/* Forward, not immediate: it re-schedules a minute out
                          so cancel keeps working. */}
                      <button className="of-rnd" style={{ width: "auto", padding: "0 8px" }}
                              disabled={busy !== null || q.status !== "scheduled"}
                              title={q.status === "scheduled"
                                ? "skip the wait — goes in about a minute, still cancellable"
                                : `this message is ${q.status}`}
                              onClick={() => void doNow(q.id)}>
                        {busy === q.id ? "…" : "send now"}
                      </button>
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
          <Note>Nothing queued.</Note>
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
          <Note>Nothing has come back yet.</Note>
        )}
      </Section>
      {/* Campaign first, person on top of it: clicking a name in the campaign
          grid should open that person without losing the grid behind it. */}
      {seqCampaign ? (
        <CampaignSequenceModal name={seqCampaign.name} accountIds={seqCampaign.ids}
                               threads={threads.data?.threads ?? []}
                               onPerson={setSeqPerson}
                               onClose={() => setSeqCampaign(null)} />
      ) : null}
      {seqPerson ? (
        <SequenceModal thread={seqPerson} onClose={() => setSeqPerson(null)} />
      ) : null}
      <Toast message={said} onDone={() => setSaid(null)} />
    </>
  );
}
