import { useMemo, useState } from "react";
import { Chip, Grid, Cell, H1, Logo, Note, Section, Stat } from "../../../ui";
import {
  deleteCampaign, setCampaignActive, useCampaigns, useEnrichment, useHeatmap, useThreads,
  type CampaignRow, type Thread,
} from "../../../lib/outreachStore";
import { AccountLink } from "./Account";
import { campaignColors } from "./campaignColors";
import { NewCampaignModal } from "./NewCampaign";
import { CampaignSequenceModal, SequenceModal } from "./SequenceModal";
import { ServerState } from "./ServerState";
import { Toast } from "./Toast";

/* Every campaign in one table.

   Outreach answers "what is the machine doing right now" — headroom, the
   heat map, the queue. This answers "what have we set running, and what is
   each one costing" and is the page you open to start or stop one. They were
   the same section for a while and it made Outreach too long to read. */

/** Derived rather than stored: a campaign is paused, or in flight, or has
    landed something, or has not started. Same four words as the account
    page, from the same facts. */
const stateOf = (c: CampaignRow): "paused" | "queued" | "running" | "not started" =>
  !c.active ? "paused" : c.queued > 0 ? "queued" : c.sent > 0 ? "running" : "not started";

const TONE = { running: "calm", queued: "cool", paused: "warm", "not started": "" } as const;

export function CrmCampaigns() {
  const campaigns = useCampaigns();
  const enrichment = useEnrichment();
  const threads = useThreads();
  const map = useHeatmap(12);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [seqCampaign, setSeqCampaign] = useState<{ name: string; ids: string[] } | null>(null);
  const [seqPerson, setSeqPerson] = useState<Thread | null>(null);
  const [making, setMaking] = useState(false);

  const rows = useMemo(() => campaigns.data?.records ?? [], [campaigns.data]);
  const byAccount = new Map((map.data?.rows ?? []).map((r) => [r.account_id, r]));

  /* Filters are questions somebody actually asks: what is live, what have I
     stopped, what is about to go out, and what would cost money to start. */
  const FILTERS = [
    { id: "all", label: "All", fn: () => true },
    { id: "active", label: "Active", fn: (c: CampaignRow) => c.active },
    { id: "paused", label: "Paused", fn: (c: CampaignRow) => !c.active },
    { id: "queued", label: "In flight", fn: (c: CampaignRow) => c.queued > 0 },
    { id: "replied", label: "Has replies", fn: (c: CampaignRow) => c.replies > 0 },
    { id: "costly", label: "Needs addresses", fn: (c: CampaignRow) => c.to_enrich > 0 },
  ] as const;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pass = FILTERS.find((f) => f.id === filter)?.fn ?? (() => true);
    return rows.filter((c) => pass(c) && (!needle
      // Search covers the three ways somebody refers to a campaign: what it
      // is called, who it is aimed at, and which company it is for.
      || `${c.name} ${c.persona} ${c.companies.join(" ")}`.toLowerCase().includes(needle)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, filter]);

  const remove = async (c: CampaignRow) => {
    if (!window.confirm(
      `Delete “${c.name}”?\n\nIt is hidden, not erased. Messages already sent keep pointing at `
      + "it, because the record of what was written to a stranger outlives the reason for it.")) return;
    setBusy(c.id);
    try {
      await deleteCampaign(c.id);
      setSaid(`“${c.name}” deleted.`);
      await campaigns.reload();
    } catch (err) {
      setSaid(err instanceof Error ? err.message : String(err));
    } finally { setBusy(null); }
  };

  const toggle = async (c: CampaignRow) => {
    const on = !c.active;
    if (on && !window.confirm(
      `Switching on “${c.name}” will:\n\n`
      + (c.to_enrich > 0
        ? `• look up ${c.to_enrich} ${c.to_enrich === 1 ? "address" : "addresses"} at Apollo `
          + `(${c.to_enrich} ${c.to_enrich === 1 ? "credit" : "credits"}, charged either way)\n`
        : "")
      + `• write round 1 to everyone it can reach — up to ${c.people} `
      + `${c.people === 1 ? "person" : "people"} — and put it in the queue\n\n`
      + "Nothing sends straight away: it is paced inside the sending window and every "
      + "message can be cancelled until it goes.\n\nContinue?")) return;
    setBusy(c.id);
    try {
      const r = await setCampaignActive(c.id, on);
      const e = r?.enrichment;
      setSaid(!on ? `“${c.name}” paused.`
        : `“${c.name}”: ${r?.queued ?? 0} queued`
          + (e ? `, ${e.found} found, ${e.missing} with no address, ${e.credits} `
                 + `${e.credits === 1 ? "credit" : "credits"} spent` : "")
          + (r?.stopped ? `. ${r.stopped}` : "."));
      await Promise.all([campaigns.reload(), enrichment.reload(), threads.reload()]);
    } catch (err) {
      setSaid(err instanceof Error ? err.message : String(err));
    } finally { setBusy(null); }
  };

  const live = rows.filter((c) => c.active);

  return (
    <>
      <H1>Campaigns</H1>

      <ServerState live={!campaigns.error} error={campaigns.error} />

      <Section kicker="What is running">
        <Grid cols={4} style={{ marginBottom: 18 }}>
          <Cell><Stat value={live.length} label="active campaigns" sub={`of ${rows.length}`} /></Cell>
          <Cell><Stat value={rows.reduce((n, c) => n + c.queued, 0)} label="messages in flight"
                      sub="still cancellable" /></Cell>
          <Cell><Stat value={rows.reduce((n, c) => n + c.replies, 0)} label="replies in" /></Cell>
          <Cell><Stat value={campaigns.data?.credits_today ?? 0} label="Apollo credits today" /></Cell>
        </Grid>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
                      marginBottom: 16 }}>
          <button className="of-facet__b" onClick={() => setMaking(true)}>+ New campaign</button>
          <input className="of-chat__in" style={{ maxWidth: 280 }}
                 placeholder="Search name, persona or company"
                 value={q} onChange={(e) => setQ(e.target.value)} />
          {FILTERS.map((f) => (
            <button key={f.id} className={`of-facet__b${filter === f.id ? " is-on" : ""}`}
                    onClick={() => setFilter(f.id)}>
              {f.label}<span className="of-facet__n">{rows.filter(f.fn).length}</span>
            </button>
          ))}
        </div>

        {shown.length ? (
          <div className="of-matrix-wrap">
            <table className="of-matrix of-crm">
              <thead>
                <tr>
                  <th className="co">Campaign</th><th>State</th><th>Companies</th><th>Persona</th>
                  <th>Tier</th><th>People</th><th>Reachable</th><th>To look up</th>
                  <th>Queued</th><th>Sent</th><th>In</th>
                  <th></th><th></th><th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const state = stateOf(c);
                  return (
                    <tr key={c.id}>
                      <td className="co">
                        {/* The campaign's own colour, the same one its pill
                            carries in the inbox — a swatch rather than a pill
                            because the name is already right here. */}
                        <span className="of-camp__sw" style={campaignColors(c.id)} />
                        {c.account_ids.length === 1 && c.account_ids[0] ? (
                          <AccountLink id={c.account_ids[0]}>
                            <span className="co-name">{c.name}</span>
                          </AccountLink>
                        ) : <span className="co-name">{c.name}</span>}

                        {c.last_at ? (
                          <span className="co-sub">last {new Date(c.last_at).toLocaleDateString()}</span>
                        ) : null}
                      </td>
                      <td className="cell"><Chip tone={TONE[state]}>{state}</Chip></td>
                      <td className="cell">
                        <span className="of-camp__cos">
                          {c.account_ids.map((aid, i) => (
                            <AccountLink key={aid} id={aid}>
                              <Logo url={byAccount.get(aid)?.url ?? null}
                                    name={c.companies[i] ?? aid} size={16} />
                              <span className="co-name">{c.companies[i] ?? aid}</span>
                            </AccountLink>
                          ))}
                        </span>
                      </td>
                      <td className="cell"><span className="of-note" title={c.persona}>
                        {c.persona.length > 54 ? `${c.persona.slice(0, 54)}…` : c.persona}
                      </span></td>
                      <td className="val">{c.template_tier}</td>
                      <td className="val">{c.people}</td>
                      <td className="val">{c.with_email}</td>
                      <td className="val">
                        {c.to_enrich ? <Chip tone="warm">{c.to_enrich}</Chip> : 0}
                      </td>
                      <td className="val">{c.queued || ""}</td>
                      <td className="val">{c.sent || ""}</td>
                      <td className="val">
                        {c.replies ? <Chip tone="calm">{c.replies}</Chip> : ""}
                      </td>
                      <td className="cell">
                        <button className="of-facet__b"
                                onClick={() => setSeqCampaign({ name: c.name, ids: c.account_ids })}
                                title="Where is everyone in this campaign">sequence</button>
                      </td>
                      <td className="cell">
                        <button className="of-facet__b" disabled={busy === c.id}
                                onClick={() => void toggle(c)}>
                          {busy === c.id ? "…" : c.active ? "pause" : "activate"}
                        </button>
                      </td>
                      <td className="cell">
                        {/* Only once it is switched off. The server refuses
                            either way; disabling it here says why before you
                            click rather than after. */}
                        <button className="of-dock__x" disabled={busy === c.id || c.active}
                                title={c.active
                                  ? "pause it first — deleting a running campaign would leave mail queued with nothing to explain it"
                                  : "forget this campaign; messages already sent are kept"}
                                onClick={() => void remove(c)}>delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Note>{rows.length === 0
            ? "No campaigns yet. Ask the agent to start one."
            : "Nothing matches that."}</Note>
        )}

      </Section>

      {making ? (
        <NewCampaignModal onClose={() => setMaking(false)}
                          onSaved={(n) => { setSaid(`“${n}” created — switched off.`);
                                            void campaigns.reload(); }} />
      ) : null}
      {seqCampaign ? (
        <CampaignSequenceModal name={seqCampaign.name} accountIds={seqCampaign.ids}
                               threads={threads.data?.threads ?? []}
                               onPerson={setSeqPerson}
                               onClose={() => setSeqCampaign(null)} />
      ) : null}
      {seqPerson ? <SequenceModal thread={seqPerson} onClose={() => setSeqPerson(null)} /> : null}
      <Toast message={said} onDone={() => setSaid(null)} />
    </>
  );
}
