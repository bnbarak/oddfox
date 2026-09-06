import { DB, tally, sum, type Rec } from "../../data";
import { Section, Grid, Cell, Table, Note, Cite, H1, Chip, Chips, Gap, Bars, Pie, Flag, Sub } from "../../ui";

export function Owners() {
  const d = DB.ownershipModel as Rec;
  const o = DB.operators as Rec;
  const f = DB.flagStates as Rec;
  const shares = (o.records as Rec[]).filter((r) => r.market_share_pct);
  const conc = f.concentration as Rec;

  return (
    <>
      <H1>Owners and ownership</H1>
      <p className="of-lede">{d.description}</p>

      <Section kicker="Shape of it">
        <Grid cols={3}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Parties by layer</div>
            <Pie items={tally(d.records as Rec[], "layer")} centreLabel="PARTIES" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Can sign a contract</div>
            <Pie centreLabel="PARTIES" items={[
              { label: "buys", value: (d.records as Rec[]).filter((r) => r.buys_security).length },
              { label: "influences", value: (d.records as Rec[]).filter((r) => r.influences_purchase).length },
              { label: "neither", value: (d.records as Rec[]).filter((r) => !r.buys_security && !r.influences_purchase).length },
            ]} /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Companies by segment</div>
            <Pie items={tally(o.records as Rec[], "segment")} centreLabel="COMPANIES" /></Cell>
        </Grid>
      </Section>

      <Section kicker="The stack">
        <Table rows={d.records as Rec[]} cols={[
          { key: "role", label: "Party", render: (r) => <><strong>{r.role}</strong><Sub>{r.definition}</Sub></> },
          { key: "layer", label: "Layer", render: (r) => <Chip tone="cool">{r.layer}</Chip> },
          { key: "who_it_usually_is", label: "In practice", render: (r) => <span className="of-note">{r.who_it_usually_is ?? ""}</span> },
          { key: "buys_security", label: "Buyer", render: (r) =>
              r.buys_security ? <Chip tone="calm">buys</Chip>
              : r.influences_purchase ? <Chip tone="cool">influences</Chip>
              : <span className="of-src">no</span> },
          { key: "found_in", label: "Where to look", render: (r) => <span className="of-note">{(r.found_in ?? ["—"]).join(", ")}</span> },
        ]} />
      </Section>

      <Section kicker="Charter types">
        <Table rows={d.charter_types as Rec[]} cols={[
          { key: "name", label: "Type", render: (r) => <><strong>{r.name}</strong><Sub>{r.what_is_rented}</Sub></> },
          { key: "who_crews", label: "Crews" },
          { key: "who_pays_bunkers", label: "Bunkers" },
          { key: "who_picks_the_route", label: "Picks the route" },
          { key: "war_risk_premium_usually_borne_by", label: "Pays war risk" },
        ]} />
      </Section>

      <Section kicker="Resolving a ship to a named party">
        <Note>{(d.resolution_path as Rec).description}</Note>
        <div style={{ marginTop: 20 }}>
          <Table rows={(d.resolution_path as Rec).steps as Rec[]} cols={[
            { key: "step", label: "#", num: true },
            { key: "input", label: "Start with" },
            { key: "action", label: "Do", render: (r) => <strong>{r.action}</strong> },
            { key: "tool", label: "Where" },
            { key: "cost", label: "Cost", render: (r) => <Chip tone={/free/.test(r.cost) ? "calm" : "warm"}>{r.cost}</Chip> },
          ]} />
        </div>
      </Section>

      <Section kicker="Companies">
        <Table rows={o.records as Rec[]} cols={[
          { key: "name", label: "Company", render: (r) => <><strong>{r.name}</strong><Sub>{r.hq ?? r.segment}</Sub></> },
          { key: "segment", label: "Segment" },
          { key: "ownership", label: "Ownership", render: (r) => <span className="of-note">{r.ownership ?? "—"}</span> },
          { key: "market_share_pct", label: "Share", num: true, render: (r) => r.market_share_pct ? `${r.market_share_pct}%` : "—" },
          { key: "fleet_vessels", label: "Vessels", num: true },
          { key: "roles", label: "Roles", render: (r) => <Chips items={(r.roles ?? []).map((x: string) => x.replace(/-/g, " "))} /> },
        ]} />
      </Section>

      <Section kicker="Container market share">
        <Grid cols={2}>
          <Cell><Pie centreLabel="PERCENT" items={[
            ...shares.map((r) => ({ label: r.name as string, value: r.market_share_pct as number })),
            { label: "all others", value: Math.max(0, Math.round((100 - sum(shares, "market_share_pct")) * 10) / 10) },
          ]} /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Fleet size, vessels</div>
            <Bars rows={(o.records as Rec[]).filter((r) => r.fleet_vessels)
              .map((r) => ({ label: r.name as string, value: r.fleet_vessels as number }))} /></Cell>
        </Grid>
        <div style={{ marginTop: 16 }}><Cite ids={["freightender-carriers-2025"]} /></div>
      </Section>

      <Section kicker="Flags and registries">
        <Grid cols={2} style={{ marginBottom: 24 }}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Capacity, million dwt</div>
            <Bars max={447} rows={(f.records as Rec[]).filter((r) => r.dwt_million).map((r) => ({
              label: <><Flag iso={r.id} name={r.name} /> {r.name}</>, value: r.dwt_million as number,
            }))} /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Top three share of world dwt</div>
            <Pie centreLabel="PERCENT" items={[
              { label: "Liberia, Panama, Marshall Islands", value: conc.share_world_dwt_pct as number },
              { label: "all other registries", value: Math.round((100 - (conc.share_world_dwt_pct as number)) * 10) / 10 },
            ]} /></Cell>
        </Grid>
        <Table rows={f.records as Rec[]} cols={[
          { key: "name", label: "Flag", render: (r) => <><Flag iso={r.id} name={r.name} /> <strong style={{ marginLeft: 8 }}>{r.name}</strong></> },
          { key: "type", label: "Type" },
          { key: "dwt_million", label: "M dwt", num: true, render: (r) => r.dwt_million ?? "—" },
          { key: "share_world_dwt_pct_2025", label: "% world", num: true, render: (r) => r.share_world_dwt_pct_2025 ? `${r.share_world_dwt_pct_2025}%` : "—" },
          { key: "note", label: "Note", render: (r) => <span className="of-note">{r.note ?? ""}</span> },
        ]} />
        <div style={{ marginTop: 16 }}><Cite ids={conc.source_ids} /></div>
      </Section>

      <Section kicker="Gaps">
        {(o.gaps as string[]).map((g, i) => <div key={i} style={{ marginBottom: 14 }}><Gap>{g}</Gap></div>)}
      </Section>
    </>
  );
}
