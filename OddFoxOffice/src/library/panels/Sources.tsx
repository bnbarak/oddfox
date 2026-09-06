import { DB, tally, type Rec } from "../../data";
import { Section, Grid, Cell, Table, Cite, H1, Chip, Bars, Pie, Callout, Gap, Flag, Sub } from "../../ui";

export function Sources() {
  const s = DB.sources as Rec;
  const f = DB.flagStates as Rec;
  const recs = s.records as Rec[];
  const conc = f.concentration as Rec;
  const nations = f.shipowning_nations as Rec;
  return (
    <>
      <H1>Sources</H1>
      <p className="of-lede">{s.description}</p>

      <Section kicker="Composition">
        <Grid cols={2}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>By type</div>
            <Pie items={tally(recs, "type")} centreLabel="SOURCES" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>By publisher, top 10</div>
            <Bars rows={tally(recs, "publisher").slice(0, 10)} /></Cell>
        </Grid>
      </Section>

      <Section kicker="Register">
        <Table rows={recs} cols={[
          { key: "name", label: "Source", render: (r) => (
              <><a className="of-link" href={r.url} target="_blank" rel="noopener"><strong>{r.name}</strong></a><Sub>{r.publisher}</Sub></>) },
          { key: "type", label: "Type", render: (r) => (
              <Chip tone={/^primary/.test(r.type) ? "calm" : r.type === "secondary" ? "cool" : "warm"}>{r.type}</Chip>) },
          { key: "access", label: "Access" },
          { key: "retrieved", label: "Retrieved", render: (r) => <span className="of-num">{r.retrieved ?? "—"}</span> },
          { key: "notes", label: "Notes", render: (r) => <span className="of-note">{r.notes ?? ""}</span> },
        ]} />
      </Section>

      <Section kicker="Flag concentration">
        <Callout>{conc.reading}</Callout>
        <div style={{ marginTop: 22 }}>
          <Bars suffix="M dwt" rows={(f.records as Rec[]).filter((r) => r.dwt_million)
            .map((r) => ({ label: <><Flag iso={r.id} name={r.name} /> {r.name}</>, value: r.dwt_million }))} />
        </div>
        <div style={{ marginTop: 22 }}><Cite ids={conc.source_ids} /></div>
      </Section>

      <Section kicker="Shipowning nations by fleet value">
        <Table rows={nations.records as Rec[]} cols={[
          { key: "rank", label: "Rank", num: true },
          { key: "nation", label: "Nation", render: (r) => <strong>{r.nation}</strong> },
          { key: "fleet_value_usd_bn", label: "USD bn", num: true, render: (r) => r.fleet_value_usd_bn ?? "—" },
          { key: "note", label: "Note", render: (r) => <span className="of-note">{r.note ?? ""}</span> },
        ]} />
        <Gap>{nations.gaps}</Gap>
        <div style={{ marginTop: 16 }}><Cite ids={nations.source_ids} /></div>
      </Section>
    </>
  );
}
