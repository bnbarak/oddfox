import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Section, Grid, Cell, Stat, Note, Chip, Site, Logo, Star } from "../../../ui";
import type { AccountRecord } from "../../../lib/crmStore";
import { cancelSend, sendNow, useCampaigns, useEnrichment, useThreads, type AccountCampaign, type Thread, type ThreadMessage } from "../../../lib/outreachStore";
import { CampaignChip, CampaignTag } from "./CampaignChip";
import { EmailBody } from "./EmailBody";
import { EmailCell } from "./EmailCell";
import { Toast } from "./Toast";
import { useFocus } from "../../../lib/pageFocus";
import { SequenceLink, SequenceModal } from "./SequenceModal";
import { SendState } from "./SendState";
import { PIPE, TONE, today, link, useAccounts, useContacts } from "./shared";

/* One account, end to end: where the company is, who we know there, and every
   message that has gone out to them. It exists because the tables answer "how
   is the whole pipeline doing" and never "what is the story with this one",
   which is the question you have just before you write to someone.

   The open account lives in the URL, so the back button works and a row on
   any table can point at it. */

export const useAccountParam = (): [string | null, (id: string | null) => void] => {
  const [params, setParams] = useSearchParams();
  const set = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("account", id); else next.delete("account");
    setParams(next);
  };
  return [params.get("account"), set];
};

/** Opens an account's page from a row on any CRM table. The page lives on the
    Accounts tab, so a row on Outreach travels there rather than growing its
    own copy of it. */
export function AccountLink({ id, children, title }: {
  id: string; children: React.ReactNode; title?: string;
}) {
  const nav = useNavigate();
  return (
    <button className="co-row co-row--btn" title={title ?? "Open this account"}
            onClick={() => nav(`/library/crm?account=${encodeURIComponent(id)}`)}>
      {children}
    </button>
  );
}

/** A contact with no name on record has their address as their name, and
    printing both reads as a bug. */
const who = (t: Thread) =>
  t.email && t.full_name !== t.email ? `${t.full_name} · ${t.email}` : (t.full_name || t.email || "—");

const fmt = (iso: string) => new Date(iso).toLocaleString([], {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
});

/* One message, read like an email rather than like a log line.

   It used to put the recipient above the card, the sender and status inside
   it, and the subject floating over the body — three separate places for the
   header of one email. Now the subject leads, because that is what you are
   looking for, and everything else is one meta line under it. */
function Message({ m, who, campaign, onSequence, onCancel, onNow, busy }: {
  m: ThreadMessage;
  /** Who this was to, or from — the counterparty either way. */
  who: string;
  /** The campaign this account is in, if any. */
  campaign?: AccountCampaign;
  onSequence?: () => void;
  onCancel?: (id: string) => void;
  onNow?: (id: string) => void;
  busy?: boolean;
}) {
  const pullable = m.dir === "out" && (m.status === "scheduled" || m.status === "draft");
  return (
    <article className={`of-msg is-${m.dir} is-open`}>
      <div className="of-msg__open">
        {m.subject ? <div className="of-msg__subj">{m.subject}</div> : null}

        <div className="of-msg__meta">
          <span>{m.dir === "out" ? "to" : "from"} {who}</span>
          {m.round ? <CampaignTag of={campaign} /> : null}
          {m.round ? (
            <SequenceLink tier={m.template_tier ?? 1} round={m.round} />
          ) : null}
          {m.round && onSequence ? (
            <button className="of-msg__tag of-msg__tag--btn" onClick={onSequence}
                    title="See this person's whole sequence">sequence</button>
          ) : null}
          {m.dry_run ? <span className="of-msg__tag">dry run</span> : null}
          <SendState m={m} />
          <span className="of-msg__at">{fmt(m.at)}</span>
        </div>

        <EmailBody html={m.html} text={m.body} />

        {pullable && (onNow || onCancel) ? (
          <div className="of-msg__acts">
            {onNow ? (
              <button className="of-facet__b" disabled={busy}
                      title="skip the wait — goes in about a minute, still cancellable"
                      onClick={() => onNow(m.id)}>send now</button>
            ) : null}
            {onCancel ? (
              <button className="of-dock__x" disabled={busy}
                      onClick={() => onCancel(m.id)}>cancel this message</button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** What the campaign is and what it would cost to run — the two things you
    want before deciding to write to this company. Enrichment is charged when
    a message is scheduled, so "to look up" is a forecast, not a debt. */
function CampaignLine({ id, people, withEmail }: {
  id: string; people: number; withEmail: number;
}) {
  const campaigns = useCampaigns();
  const here = campaigns.data?.states[id];
  const row = campaigns.data?.records.find((c) => c.id === here?.campaign_id);

  if (!here || here.state === "none") {
    return <Note style={{ margin: "16px 0 4px" }}>Not in a campaign. Ask the agent to start one.</Note>;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  margin: "16px 0 4px" }}>
      <strong style={{ fontSize: 13.5 }}>{here.campaign_name}</strong>
      <CampaignChip of={here} />
      <span className="of-note">
        {withEmail} of {people} reachable
        {row?.to_enrich ? ` · ${row.to_enrich} to look up at Apollo on activation` : ""}
        {row?.unreachable ? ` · ${row.unreachable} with no address to be found` : ""}
      </span>
    </div>
  );
}

export function AccountDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { rows: accounts, live, patch } = useAccounts();
  const { rows: contacts } = useContacts();
  const threadsRes = useThreads();
  const campaigns = useCampaigns();
  const enrichment = useEnrichment();
  // Tells the agent in the dock whose page this is.
  useFocus({ account: id, label: accounts.find((r) => r.id === id)?.company ?? id });
  const [seqFor, setSeqFor] = useState<Thread | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  /* Cancel and send-now are the two halves of one decision — this message is
     wrong and should stop, or it is right and should not wait for the window
     — so they share a call site and a toast. */
  const act = async (id: string, what: "cancel" | "now") => {
    setBusy(true);
    try {
      const r = what === "cancel" ? await cancelSend(id) : await sendNow(id);
      setSaid(r?.note ?? "done");
      await threadsRes.reload();
    } catch (e) { setSaid(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const looked = new Map((enrichment.data?.records ?? []).map((e) => [e.contact_id, e]));

  const a = accounts.find((r) => r.id === id);
  if (!a) {
    return (
      <>
        <button className="of-facet__b" onClick={onBack}>← Accounts</button>
        <Note style={{ marginTop: 16 }}>No account with the id “{id}”.</Note>
      </>
    );
  }

  const people = contacts.filter((c) => c.account_id === a.id);
  const emails = new Set(people.map((c) => c.email).filter(Boolean) as string[]);
  const threads: Thread[] = (threadsRes.data?.threads ?? []).filter(
    (t) => t.account_id === a.id || (t.email ? emails.has(t.email) : false));
  const messages = threads.flatMap((t) => t.messages.map((m) => ({ m, t })))
    .sort((x, y) => x.m.at.localeCompare(y.m.at));
  const sent = messages.filter((x) => x.m.dir === "out").length;
  const back = messages.filter((x) => x.m.dir === "in").length;
  const href = link(a);

  return (
    <>
      <button className="of-facet__b" onClick={onBack}>← Accounts</button>

      <div className="of-acct__head">
        {/* Only a real logo. The initials fallback is useful in a table of
            forty rows; next to the company's own name in 44px it is noise. */}
        {a.url ? <Logo url={a.url} name={a.company} size={32} /> : null}
        <h1 className="of-acct__name">{a.company}</h1>
        <Star on={a.starred} title="Starred account" />
      </div>

      <div className="of-acct__tags">
        <Chip tone={TONE[a.status] ?? ""}>{a.status}</Chip>
        <Chip>tier {a.tier} · {a.tier_name}</Chip>
      </div>

      <div className="of-acct__links">
        {a.url ? <Site url={a.url} /> : null}
        {a.linkedin_url ? <Site url={a.linkedin_url} label="LinkedIn page" /> : null}
        {a.email ? <a className="of-link of-site" href={`mailto:${a.email}`}>{a.email}</a> : null}
        {a.phone ? <span className="of-note">{a.phone}</span> : null}
        {!href && !a.email && !a.phone ? <Chip tone="warm">no link on record</Chip> : null}
      </div>

      <div className="of-note of-acct__meta">
        {[a.head_office, a.country,
          a.fleet ? `${a.fleet} vessels` : null,
          a.vessel_attacked?.length ? `attacked: ${a.vessel_attacked.join(", ")}` : null,
          a.owner ? `owner ${a.owner}` : null,
        ].filter(Boolean).join(" · ") || "Nothing else on record."}
      </div>

      <Section kicker="Campaign">
        <Grid cols={4}>
          <Cell><Stat value={sent} label="messages sent" /></Cell>
          <Cell><Stat value={back} label="replies in" /></Cell>
          <Cell><Stat value={people.length} label="people on record" /></Cell>
          <Cell><Stat value={a.last_touch ?? "—"} label="last touch" /></Cell>
        </Grid>

        <CampaignLine id={a.id} people={people.length}
                      withEmail={people.filter((c) => c.email).length} />

        <div className="of-acct__rounds">
          {([1, 2, 3] as const).map((n) => {
            const d = a.sequence?.[`round_${n}`];
            return (
              <span key={n} className="of-acct__round">
                <span className="of-note">round {n}</span>
                {d ? <Chip tone="warm">{d}</Chip> : <Chip>not sent</Chip>}
              </span>
            );
          })}
          <select className="of-sel" value={a.status} disabled={!live}
                  onChange={(e) => void patch(a.id, {
                    status: e.target.value as AccountRecord["status"], last_touch: today() })}>
            {PIPE.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Section>

      <Section kicker="People">
        {people.length ? (
          <div className="of-matrix-wrap">
            <table className="of-matrix of-crm">
              <thead><tr>
                <th className="co">Name</th><th>Title</th><th>Buying role</th>
                <th>Email</th><th>LinkedIn</th><th>Written to</th>
              </tr></thead>
              <tbody>
                {people.map((c) => {
                  const mine = messages.filter((x) => x.t.contact_id === c.id
                    || (c.email ? x.t.email === c.email : false));
                  const out = mine.filter((x) => x.m.dir === "out").length;
                  return (
                    <tr key={c.id}>
                      <td className="co">
                        <span className="co-row">
                          <span className="co-name">{c.full_name}</span>
                          <Star on={c.starred} title="Starred contact" />
                        </span>
                      </td>
                      <td className="cell"><span className="of-note">{c.title}</span></td>
                      <td className="cell"><Chip>{c.buying_role}</Chip></td>
                      <td className="cell">
                        <EmailCell email={c.email} found={looked.get(c.id)} />
                      </td>
                      <td className="cell">{c.linkedin_url
                        ? <Site url={c.linkedin_url} label="profile" />
                        : <span className="of-dot-off" title="no public profile found" />}</td>
                      <td className="val">{out || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Note>No people on record for this account yet.</Note>
        )}
      </Section>

      <Section kicker="What was sent">
        {threadsRes.error && <Note style={{ marginBottom: 12 }}>{threadsRes.error}</Note>}
        {messages.length ? (
          <>
            {messages.map(({ m, t }) => (
              <Message key={`${t.key}-${m.dir}-${m.id}`} m={m} busy={busy}
                       who={who(t)}
                       campaign={campaigns.data?.states[a.id]}
                       onSequence={() => setSeqFor(t)}
                       onCancel={(id) => void act(id, "cancel")}
                       onNow={(id) => void act(id, "now")} />
            ))}
          </>
        ) : (
          <Note>{threadsRes.busy ? "Loading…" : "Nothing has been sent to this account."}</Note>
        )}
      </Section>

      {seqFor ? <SequenceModal thread={seqFor} onClose={() => setSeqFor(null)} /> : null}
      <Toast message={said} onDone={() => setSaid(null)} />
    </>
  );
}
