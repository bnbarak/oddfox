import { DB, tally, type Rec } from "../../data";
import { Section, Grid, Cell, Note, Cite, H1, H2, Card, Chip, Chips, Gap, Pie, Callout } from "../../ui";

const KIND_TITLE: Record<string, string> = {
  identity: "Identity", reporting: "Reporting", risk: "Risk",
};

export function Registries() {
  const d = DB.registries as Rec;
  const all = d.records as Rec[];
  return (
    <>
      <H1>Registries</H1>
      <p className="of-lede">{d.description}</p>

      <Section kicker="By kind">
        <Grid cols={2}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Registries by kind</div>
            <Pie items={tally(all, "kind")} centreLabel="REGISTRIES" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Machine readable</div>
            <Pie centreLabel="REGISTRIES" items={[
              { label: "machine readable", value: all.filter((r) => r.machine_readable).length },
              { label: "not, or unknown", value: all.filter((r) => !r.machine_readable).length },
            ]} /></Cell>
        </Grid>
      </Section>

      {["identity", "reporting", "risk"].map((kind) => {
        const rs = all.filter((r) => r.kind === kind);
        if (!rs.length) return null;
        return (
          <Section key={kind} kicker={KIND_TITLE[kind]}>
            {rs.map((r) => (
              <Card key={r.id} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  {r.url ? <a className="of-link" href={r.url} target="_blank" rel="noopener"><H2>{r.name}</H2></a>
                         : <H2>{r.name}</H2>}
                  {r.access && <Chip tone={/free|public/.test(r.access) ? "calm" : "warm"}>{r.access}</Chip>}
                  {r.machine_readable && <Chip tone="cool">machine readable</Chip>}
                </div>
                {r.operator && <div className="of-src" style={{ marginTop: 8 }}>{r.operator}{r.area ? ` · ${r.area}` : ""}</div>}
                {r.answers && <p style={{ marginTop: 14, fontSize: "14.5px" }}>{r.answers}</p>}
                {r.role && <Note style={{ marginTop: 10 }}>{r.role}</Note>}
                {r.holds && <div style={{ marginTop: 14 }}><Chips items={r.holds} /></div>}
                {r.listed_regions && <div style={{ marginTop: 14 }}><Chips items={r.listed_regions} tone="hot" /></div>}
                {r.current_circular && <Note style={{ marginTop: 12 }}>{r.current_circular}</Note>}
                {r.caveat && <Gap style={{ marginTop: 14 }}>{r.caveat}</Gap>}
                {r.source_ids && <div style={{ marginTop: 12 }}><Cite ids={r.source_ids} /></div>}
              </Card>
            ))}
          </Section>
        );
      })}

      <Section kicker="How they fit together">
        {(d.how_they_fit as string[]).map((x, i) => (
          <div key={i} style={{ marginBottom: i < (d.how_they_fit as string[]).length - 1 ? 16 : 0 }}>
            <Callout>{x}</Callout>
          </div>
        ))}
      </Section>
    </>
  );
}
