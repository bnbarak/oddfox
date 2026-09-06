import { DB, point, pctChange, sum, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Table, Note, Cite, ConfChip, H1, Toggle,
         Bars, WorldMap, Columns } from "../../ui";

export function Overview({ geoSeries, setGeoSeries }: {
  geoSeries: string; setGeoSeries: (v: string) => void;
}) {
  const m = DB.manifest;
  const ht = DB.houthiTimeline;
  const imb = point("imb-global-annual", "2025")!;
  const h1 = point("imb-global-halfyear", "2026-H1")!;
  const soms = point("soms-halfyear", "2026-H1")!;
  const hormuz = (DB.riskEconomics.premiums as Rec[]).find((p) => p.id === "hormuz-2026-07")!;

  const g = DB.geoIncidents;
  const all = g.series as Rec[];
  const series = all.find((s) => s.id === geoSeries) ?? all[0];

  return (
    <>
      <H1>Business context</H1>
      <p className="of-lede">{m.purpose}</p>

      <Section kicker="Headline counts">
        <Grid cols={4}>
          <Cell><Stat value={imb} label="IMB incidents worldwide, 2025" sub="IMB annual"
                      delta={pctChange(point("imb-global-annual", "2024")!, imb)} /></Cell>
          <Cell><Stat value={h1} label="IMB incidents worldwide, H1 2026" sub="lowest H1 since 1992"
                      delta={pctChange(point("imb-global-halfyear", "2025-H1")!, h1)} /></Cell>
          <Cell><Stat value={soms} label="Malacca & Singapore, H1 2026" sub="ReCAAP"
                      delta={pctChange(point("soms-halfyear", "2025-H1")!, soms)} /></Cell>
          <Cell><Stat value={hormuz.label} label="Hormuz war risk, July 2026" sub="% of hull value" /></Cell>
        </Grid>
      </Section>

      <Section kicker="Incidents by location">
        <p className="of-lede" style={{ marginTop: -6 }}>{g.description}</p>
        <Toggle options={all.map((s) => ({ id: s.id as string, label: s.label as string }))}
                value={geoSeries} onChange={setGeoSeries} />
        <Grid cols={3} style={{ marginBottom: 22 }}>
          <Cell><Stat value={series.total} label="reported total for the period" sub={`${series.body} · ${series.period}`} /></Cell>
          <Cell><Stat value={(series.points as Rec[]).length} label="locations plotted"
                      sub={series.complete ? "points sum to the published total" : "points do not sum to the total"} /></Cell>
          <Cell><Stat value={sum(series.points as Rec[], "count")} label="accounted for by these points" /></Cell>
        </Grid>
        <WorldMap points={series.points as any} reference={g.reference_points as any} label={series.label} />
        {series.note ? <Note style={{ marginTop: 16 }}>{series.note}</Note> : null}
        <div style={{ marginTop: 12 }}><ConfChip level={series.confidence} /></div>
        <div style={{ marginTop: 12 }}><Cite ids={series.source_ids} /></div>
      </Section>

      <Section kicker={`Points plotted — ${series.label}`}>
        <Table rows={series.points as Rec[]} cols={[
          { key: "name", label: "Location", render: (r) => <strong>{r.name}</strong> },
          { key: "coords", label: "Lat, lon", render: (r) => <span className="of-num">{r.coords[0].toFixed(2)}, {r.coords[1].toFixed(2)}</span> },
          { key: "count", label: "Count", num: true, render: (r) => r.count != null ? <strong>{r.count}</strong> : (r.unquantified ?? "—") },
          { key: "note", label: "Note", render: (r) => <span className="of-note">{r.note ?? ""}</span> },
        ]} />
      </Section>

      <Section kicker="Comparison across series">
        <Bars rows={all.map((s) => ({
          label: s.label as string, value: s.total as number,
          tone: s.body === "ReCAAP" ? "cool" : s.body === "IMB" ? "hot" : "warm",
        }))} />
        <Note style={{ marginTop: 16 }}>
          Series are not comparable with each other: different counting bodies, areas and periods.
        </Note>
      </Section>

      <Section kicker="Houthi attacks per month, Nov 2023 – Aug 2026">
        <Columns points={(ht.monthly as Rec[]).map((x) => ({
          label: x.month, value: x.count, tone: x.count >= 10 ? "hot" : "",
        }))} height={240} label="Houthi attacks per month" />
        <div style={{ marginTop: 14 }}><Cite ids={ht.source_ids} /></div>
      </Section>

      <Section kicker="Open items">
        <ul>
          {(m.roadmap as string[]).map((r) => (
            <li key={r} className="of-note" style={{ padding: "9px 0", borderBottom: "1px solid var(--line-soft)" }}>{r}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}
