import { DB, tally, type Rec } from "../../data";
import { Section, Grid, Cell, Table, Note, Cite, H1, H2, Card, Chip, Chips, Pie, WorldMap, Src, Sub } from "../../ui";

const statusTone = (s: string) =>
  /active|acute|resurgent|deteriorating/.test(s) ? "hot"
  : /suppressed|elevated|contained|emerging/.test(s) ? "warm"
  : /declining|recovered/.test(s) ? "cool" : "calm";

export function Passages() {
  const d = DB.chokepoints as Rec;
  const rows = d.records as Rec[];
  return (
    <>
      <H1>High-risk passages</H1>
      <p className="of-lede">{d.description}</p>

      <Section kicker="Locations">
        <WorldMap world label="passages, sized by named incidents held in this library"
                  points={rows.filter((r) => r.coords).map((r) => ({
                    name: r.name as string, coords: r.coords,
                    count: (r.incident_ids ?? []).length || null,
                    unquantified: (r.incident_ids ?? []).length ? null : "no named incidents in this library",
                  }))} />
        <Note style={{ marginTop: 16 }}>
          Circles are sized by the number of named incidents held in incidents.json, not by total reported incidents.
          For reported counts use the Overview tab.
        </Note>
      </Section>

      <Section kicker="Summary">
        <Grid cols={2}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Status</div>
            <Pie items={tally(rows, "status")} centreLabel="PASSAGES" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Named on oddfox.ai</div>
            <Pie centreLabel="PASSAGES" items={[
              { label: "named on site", value: rows.filter((r) => r.on_oddfox_site).length },
              { label: "not named", value: rows.filter((r) => !r.on_oddfox_site).length },
            ]} /></Cell>
        </Grid>
      </Section>

      <Section kicker="All passages">
        <Table rows={rows} cols={[
          { key: "name", label: "Passage", render: (r) => <><strong>{r.name}</strong><Sub>{r.region}</Sub></> },
          { key: "on_oddfox_site", label: "On site", render: (r) => r.on_oddfox_site ? <Chip tone="solid">named</Chip> : <span className="of-src">—</span> },
          { key: "status", label: "Status", render: (r) => <Chip tone={statusTone(r.status) as any}>{r.status}</Chip> },
          { key: "threat_types", label: "Threat", render: (r) => <span className="of-note">{(r.threat_types ?? []).join(", ")}</span> },
        ]} />
      </Section>

      <Section kicker="Detail">
        {rows.map((r) => (
          <Card key={r.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <H2>{r.name}</H2>
              {r.on_oddfox_site && <Chip tone="solid">named on oddfox.ai</Chip>}
              {r.coords && <Src>{r.coords[0].toFixed(2)}, {r.coords[1].toFixed(2)}</Src>}
            </div>
            <div style={{ marginTop: 12 }}><Chips items={r.threat_types ?? []} /></div>
            {r.status_note && <Note style={{ marginTop: 14 }}>{r.status_note}</Note>}
            {r.reporting_body && <Src style={{ marginTop: 12 }}>Report to: {r.reporting_body}</Src>}
            {r.source_ids && <div style={{ marginTop: 10 }}><Cite ids={r.source_ids} /></div>}
          </Card>
        ))}
      </Section>
    </>
  );
}
