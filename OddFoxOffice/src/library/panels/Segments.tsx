import { DB, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Table, Note, Cite, H1, H2,
         Flag, Bars, Gap, Site, ConfChip } from "../../ui";

export function Segments() {
  const c = DB.customers as unknown as Rec;
  const segs = c.segments as Rec[];
  const br = c.buying_roles as Rec;
  const withOps = segs.filter((s) => (s.operators as Rec[])?.length);
  const sm = c.ship_managers as Rec;

  return (
    <>
      <H1>Addressable operators by segment</H1>
      <p className="of-lede">{c.description as string}</p>

      <Section kicker="Exposure against coverage">
        <Grid cols={3}>
          {segs.map((s) => (
            <Cell key={s.id as string}>
              <Stat value={((s.exposure as Rec[])[0]?.value as number) ?? "—"}
                    label={(s.exposure as Rec[])[0]?.measure as string}
                    sub={`${s.operator_coverage_in_library} operators in this library`} />
            </Cell>
          ))}
        </Grid>
        <Note style={{ marginTop: 16 }}>
          Dry bulk is the most-attacked segment and had one operator record. Tankers appear in five named
          incidents and have none.
        </Note>
      </Section>

      <Section kicker="Who pays, by charter type">
        <Table rows={br.who_pays_by_charter as Rec[]} cols={[
          { key: "charter", label: "Charter type", render: (r) => <strong>{r.charter}</strong> },
          { key: "war_risk_premium_borne_by", label: "War risk premium usually borne by" },
        ]} />
        <Note style={{ marginTop: 14 }}>{br.note as string}</Note>
      </Section>

      {withOps.map((s) => (
        <Section key={s.id as string} kicker={`${s.name} operators`}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", marginBottom: 14 }}>
            <H2>{s.name}</H2><ConfChip level={s.confidence} />
          </div>
          <p className="of-note" style={{ marginBottom: 16 }}>{s.why_in_scope as string}</p>
          <Bars rows={(s.operators as Rec[])
            .map((o) => ({ o, n: (o.fleet_bulk_carriers ?? o.fleet_tankers) as number | undefined }))
            .filter((x) => x.n)
            .map(({ o, n }) => ({
              label: <><Flag iso={o.country_iso} name={o.country} /> {o.name}</>,
              value: n as number, tone: "cool",
            }))} />
          <Table rows={s.operators as Rec[]} cols={[
            { key: "name", label: "Operator", render: (o) => (
                <><Flag iso={o.country_iso} name={o.country} /> <strong style={{ marginLeft: 8 }}>{o.name}</strong></>) },
            { key: "country", label: "Country" },
            { key: "fleet", label: "Fleet", num: true,
              render: (o) => (o.fleet_bulk_carriers ?? o.fleet_tankers ?? "—") as any },
            { key: "note", label: "Note", render: (o) => (
                <span className="of-note">{(o.note ?? o.fleet_basis ?? "") as string}</span>) },
            { key: "url", label: "Website", render: (o) => <Site url={o.url as string} /> },
          ]} />
          <div style={{ marginTop: 14 }}><Cite ids={s.source_ids} /></div>
        </Section>
      ))}

      <Section kicker="Third-party ship managers">
        <p className="of-lede" style={{ marginTop: -6 }}>{(sm.why_this_matters as string)}</p>
        <Grid cols={2} style={{ marginBottom: 20 }}>
          <Cell><Stat value={(sm.records as Rec[]).reduce((a, r) => a + (r.fleet_managed as number), 0).toLocaleString()}
                      label="vessels under management across five firms" sub="all vessel types" /></Cell>
          <Cell><Stat value={(sm.records as Rec[]).length} label="firms" sub="each buys security under the ownership model" /></Cell>
        </Grid>
        <Bars rows={(sm.records as Rec[]).map((r) => ({
          label: r.name as string, value: r.fleet_managed as number, tone: "hot",
        }))} />
        <Table rows={sm.records as Rec[]} cols={[
          { key: "name", label: "Manager", render: (r) => <strong>{r.name}</strong> },
          { key: "fleet_managed", label: "Vessels managed", num: true },
          { key: "basis", label: "What the figure counts", render: (r) => <span className="of-note">{r.basis}</span> },
          { key: "url", label: "Website", render: (r) => <Site url={r.url as string} /> },
          { key: "src", label: "Source", render: (r) => <Cite ids={r.source_ids} /> },
        ]} />
        {(sm.gaps as string[]).map((g) => <Gap key={g}>{g}</Gap>)}
      </Section>

      {segs.filter((s) => s.gap).map((s) => (
        <Section key={s.id as string} kicker={`${s.name} — not yet researched`}>
          <Gap>{s.gap as string}</Gap>
        </Section>
      ))}
    </>
  );
}
