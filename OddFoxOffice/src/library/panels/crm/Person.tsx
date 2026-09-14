import { useState } from "react";
import { Link } from "react-router-dom";
import { Section, Grid, Cell, Stat, Note, Chip, Site, Logo, Star } from "../../../ui";
import type { ContactRecord } from "../../../lib/crmStore";
import {
  cancelSend, sendNow, useCampaigns, useEnrichment, useThreads, type Thread,
} from "../../../lib/outreachStore";
import { AccountLink } from "./links";
import { CampaignChip } from "./CampaignChip";
import { EmailCell } from "./EmailCell";
import { Message } from "./Message";
import { Toast } from "./Toast";
import { useFocus } from "../../../lib/pageFocus";
import { SequenceModal } from "./SequenceModal";
import { PIPE, TONE, useAccounts, useContacts } from "./shared";

/* One person, end to end: who they are, and every message that has ever
   passed between us and them, oldest first.

   The account page answers "what is the story with this company", which is
   the question you have before you write to a company. This is the other one
   — "what have we actually said to *them*" — and it is not the same page:
   somebody with two conversations under two subjects appears twice in the
   Inbox and nowhere as a whole, and their company's history is mostly about
   their colleagues.

   The open person lives in the URL, so the back button works and a row on any
   table can point here. */

/** Every thread that is this person's: the ones the server already tied to
    them, plus any under their address that predate the tie. */
const theirs = (c: ContactRecord, all: Thread[]): Thread[] =>
  all.filter((t) => t.contact_id === c.id || (c.email ? t.email === c.email : false));

/* A day, short. The full ISO date is what an account's "last touch" shows,
   but in a stat tile it breaks across two lines at its own hyphen and reads
   as damage. */
const day = (iso: string | null | undefined) =>
  (iso ? new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }) : null);
const year = (iso: string | null | undefined) => {
  const y = iso ? new Date(iso).getFullYear() : null;
  return y && y !== new Date().getFullYear() ? String(y) : undefined;
};

export function PersonDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { rows: contacts, live, patch } = useContacts();
  const { rows: accounts } = useAccounts();
  const threadsRes = useThreads();
  const campaigns = useCampaigns();
  const enrichment = useEnrichment();
  const [seqFor, setSeqFor] = useState<Thread | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const c = contacts.find((r) => r.id === id);
  // Tells the agent in the dock whose page this is. Before the early return,
  // because hooks cannot be called conditionally.
  useFocus({ contact: id, account: c?.account_id ?? undefined, label: c?.full_name ?? id });

  const act = async (sendId: string, what: "cancel" | "now") => {
    setBusy(true);
    try {
      const r = what === "cancel" ? await cancelSend(sendId) : await sendNow(sendId);
      setSaid(r?.note ?? "done");
      await threadsRes.reload();
    } catch (e) { setSaid(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  if (!c) {
    return (
      <>
        <button className="of-facet__b" onClick={onBack}>← People</button>
        <Note style={{ marginTop: 16 }}>No person with the id “{id}”.</Note>
      </>
    );
  }

  // Most contact rows carry a company name but no account_id, so fall back to
  // the name — the same fallback the People table makes.
  const acct = accounts.find((a) => a.id === c.account_id)
    ?? accounts.find((a) => a.company === c.company);
  const campaign = acct ? campaigns.data?.states[acct.id] : undefined;
  const found = enrichment.data?.records.find((e) => e.contact_id === c.id);

  const threads = theirs(c, threadsRes.data?.threads ?? []);
  const messages = threads.flatMap((t) => t.messages.map((m) => ({ m, t })))
    .sort((x, y) => x.m.at.localeCompare(y.m.at));
  const sent = messages.filter((x) => x.m.dir === "out").length;
  const back = messages.filter((x) => x.m.dir === "in").length;
  const opened = messages.filter((x) => x.m.opened_at).length;
  const last = messages[messages.length - 1]?.m.at;

  return (
    <>
      <button className="of-facet__b" onClick={onBack}>← People</button>

      <div className="of-acct__head">
        <h1 className="of-acct__name">{c.full_name}</h1>
        <Star on={c.starred} title="Starred contact" />
      </div>

      <div className="of-acct__tags">
        <Chip tone={TONE[c.status] ?? ""}>{c.status}</Chip>
        {c.buying_role ? <Chip>{c.buying_role}</Chip> : null}
        {c.priority ? <Chip tone={c.priority === 1 ? "hot" : c.priority === 2 ? "warm" : ""}>
          priority {c.priority}</Chip> : null}
        {c.connection_degree === 1 ? <Chip tone="calm">1st-degree</Chip> : null}
        {c.replied ? <Chip tone="calm">replied</Chip> : null}
      </div>

      <div className="of-acct__links">
        <span className="of-note">{c.title || "role unknown"}</span>
        {acct ? (
          <span className="of-cell-co">
            <Logo url={acct.url ?? null} name={acct.company} size={16} />
            <AccountLink id={acct.id} title="Open this account">
              <span className="co-name">{acct.company}</span>
            </AccountLink>
          </span>
        ) : c.company ? <span className="of-note">{c.company}</span> : null}
        <EmailCell email={c.email} found={found} />
        {c.linkedin_url ? <Site url={c.linkedin_url} label="LinkedIn profile" /> : null}
        {c.phone_office ? <span className="of-note">{c.phone_office}</span> : null}
        {c.source_url ? <Site url={c.source_url} label="source" /> : null}
      </div>

      <div className="of-note of-acct__meta">
        {[c.location, c.background, c.connection_note, c.notes]
          .filter(Boolean).join(" · ") || "Nothing else on record."}
      </div>

      <Section kicker="Contact">
        <Grid cols={4}>
          <Cell><Stat value={sent} label="messages sent" /></Cell>
          <Cell><Stat value={back} label="replies in" /></Cell>
          <Cell><Stat value={opened} label="opened" sub={`of ${sent} sent`} /></Cell>
          <Cell><Stat value={day(last) ?? "—"} label="last message" sub={year(last)} /></Cell>
        </Grid>

        {campaign && campaign.state !== "none" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                        margin: "16px 0 4px" }}>
            <strong style={{ fontSize: 13.5 }}>{campaign.campaign_name}</strong>
            <CampaignChip of={campaign} />
            <span className="of-note">
              {c.email ? "reachable" : "no address on record — nothing can go to them"}
            </span>
          </div>
        ) : (
          <Note style={{ margin: "16px 0 4px" }}>
            {acct ? "Their company is not in a campaign." : "Not tied to an account on record."}
          </Note>
        )}

        <div className="of-acct__rounds">
          {([1, 2, 3] as const).map((n) => {
            const d = c.sequence?.[`round_${n}`];
            return (
              <span key={n} className="of-acct__round">
                <span className="of-note">round {n}</span>
                {d ? <Chip tone="warm">{d}</Chip> : <Chip>not sent</Chip>}
              </span>
            );
          })}
          <select className="of-sel" value={c.status} disabled={!live}
                  onChange={(e) => void patch(c.id,
                    { status: e.target.value as ContactRecord["status"] })}>
            {PIPE.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Section>

      <Section kicker="Everything, oldest first">
        {threadsRes.error && <Note style={{ marginBottom: 12 }}>{threadsRes.error}</Note>}
        {messages.length ? (
          messages.map(({ m, t }) => (
            <Message key={`${t.key}-${m.dir}-${m.id}`} m={m} busy={busy}
                     who={c.full_name}
                     campaign={campaign}
                     onSequence={() => setSeqFor(t)}
                     onCancel={(sid) => void act(sid, "cancel")}
                     onNow={(sid) => void act(sid, "now")}
                     extra={
                       /* Reading happens here; replying happens in the Inbox,
                          which is where the composer and the read state live. */
                       <Link className="of-msg__tag" to={`/library/crm-inbox?thread=${encodeURIComponent(t.id)}`}
                             title="Open this conversation in the Inbox">
                         in the inbox
                       </Link>
                     } />
          ))
        ) : (
          <Note>{threadsRes.busy ? "Loading…" : "Nothing has been sent to this person, and nothing has come back."}</Note>
        )}
      </Section>

      {seqFor ? <SequenceModal thread={seqFor} onClose={() => setSeqFor(null)} /> : null}
      <Toast message={said} onDone={() => setSaid(null)} />
    </>
  );
}
