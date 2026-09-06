import { DB, series as getSeries, type Rec } from "../../data";
import { Section, Grid, Cell, Table, Note, Cite, H1, H3, Card, Src, Toggle,
         Bars, LineChart, Slope, WorldMap, Flag } from "../../ui";

const HY = [
  { id: "imb-global-halfyear", label: "Worldwide", body: "IMB" },
  { id: "recaap-asia-halfyear", label: "Asia", body: "ReCAAP" },
  { id: "soms-halfyear", label: "Malacca & Singapore", body: "ReCAAP" },
  { id: "singapore-strait-imb-halfyear", label: "Singapore Straits", body: "IMB" },
];

export function Threat({ geoSeries, setGeoSeries }: { geoSeries: string; setGeoSeries: (v: string) => void }) {
  const d = DB.threatStats, g = DB.geoIncidents, ht = DB.houthiTimeline;
  const annual = ["imb-global-annual", "recaap-asia-annual", "imo-global-annual"]
    .map(getSeries).filter(Boolean) as Rec[];
  const slopeRows = HY.map((x) => {
    const s = getSeries(x.id) as Rec | undefined;
    const a = s?.points.find((p: Rec) => p.period === "2025-H1");
    const b = s?.points.find((p: Rec) => p.period === "2026-H1");
    return a && b ? { label: x.label, body: x.body, from: a.value, to: b.value } : null;
  }).filter(Boolean) as any[];
  const s25 = (g.series as Rec[]).find((s) => s.id === "recaap-2025-h1");
  const s26 = (g.series as Rec[]).find((s) => s.id === "recaap-2026-h1");
  const byCountry = (d.breakdowns as Rec[]).find((b) => b.id === "recaap-2026h1-by-country");
  const series = (g.series as Rec[]).find((s) => s.id === geoSeries) ?? (g.series as Rec[])[0];

  return (
    <>
      <H1>Incident counts</H1>
      <p className="of-lede">{d.description}</p>

      <Section kicker="Worldwide and regional annual totals">
        <Bars rows={annual.flatMap((s) => (s.points as Rec[]).map((p) => ({
          label: `${s.body} ${p.period}`, value: p.value,
          tone: (s.body === "IMB" ? "hot" : s.body === "ReCAAP" ? "cool" : "warm") as any,
        })))} />
        <Note style={{ marginTop: 18 }}>
          IMB and IMO both count worldwide; ReCAAP counts Asia only. IMO recorded 171 for 2025 against IMB’s 137 for the same year.
        </Note>
      </Section>

      <Section kicker="First half 2025 against first half 2026">
        <Slope rows={slopeRows} height={320} fromLabel="JAN–JUN 2025" toLabel="JAN–JUN 2026" />
        <div style={{ marginTop: 20 }}><Cite ids={["imb-h1-2026", "recaap-hy-2026"]} /></div>
      </Section>

      {s25 && s26 && (
        <Section kicker="Same water, twelve months apart">
          <div className="of-twin">
            <div>
              <H3>{s25.label}</H3>
              <Src style={{ marginTop: 4 }}>{s25.total} incidents</Src>
              <WorldMap points={s25.points as any} label={s25.label} maxRef={s25.total as number} />
            </div>
            <div>
              <H3>{s26.label}</H3>
              <Src style={{ marginTop: 4 }}>{s26.total} incidents</Src>
              <WorldMap points={s26.points as any} label={s26.label} maxRef={s25.total as number} />
            </div>
          </div>
          <Note style={{ marginTop: 16 }}>Both maps are drawn to the same circle scale, so areas are directly comparable between them.</Note>
          <div style={{ marginTop: 12 }}><Cite ids={s26.source_ids} /></div>
        </Section>
      )}

      {byCountry && (
        <Section kicker="By location, ReCAAP">
          <Table rows={byCountry.items as Rec[]} cols={[
            { key: "label", label: "Location", render: (r) => <><Flag iso={r.flag_iso} name={r.label} /> <strong style={{ marginLeft: 8 }}>{r.label}</strong></> },
            { key: "2025-H1", label: "H1 2025", num: true },
            { key: "2026-H1", label: "H1 2026", num: true },
            { key: "delta", label: "Change", num: true, render: (r) => {
                const a = r["2025-H1"], b = r["2026-H1"];
                if (a === b) return <span className="of-src">no change</span>;
                const dd = b - a;
                return <span className={`of-delta ${dd > 0 ? "up" : "down"}`}>{dd > 0 ? "+" : ""}{dd}</span>;
              } },
          ]} />
          <div style={{ marginTop: 16 }}><Cite ids={byCountry.source_ids ?? [byCountry.source_id]} /></div>
        </Section>
      )}

      <Section kicker={`Where — ${series.label}`}>
        <Toggle options={(g.series as Rec[]).map((s) => ({ id: s.id as string, label: s.label as string }))}
                value={geoSeries} onChange={setGeoSeries} />
        <WorldMap points={series.points as any} reference={g.reference_points as any} label={series.label} />
        <div style={{ marginTop: 14 }}><Cite ids={series.source_ids} /></div>
      </Section>

      <Section kicker="Houthi campaign, monthly">
        <LineChart points={(ht.monthly as Rec[]).map((m) => ({ label: m.month, value: m.count }))}
                   height={230} labelEvery={3} label="Houthi attacks per month" />
        <Grid cols={2} style={{ marginTop: 26 }}>
          <Cell>
            <div className="of-kicker" style={{ marginBottom: 14 }}>Outcome</div>
            <Bars rows={(ht.outcomes as Rec[]).map((o) => ({
              label: o.label, value: o.value,
              tone: (o.label === "sunk" ? "hot" : o.label === "captured" ? "warm" : "") as any,
            }))} />
          </Cell>
          <Cell>
            <div className="of-kicker" style={{ marginBottom: 14 }}>Flag of vessel attacked</div>
            <Bars rows={(ht.flags as Rec[]).slice(0, 10).map((f) => ({
              label: <><Flag iso={f.flag_iso} name={f.flag} /> {f.flag}</>, value: f.value,
            }))} max={(ht.flags as Rec[])[0].value as number} />
          </Cell>
        </Grid>
        <div style={{ marginTop: 16 }}><Cite ids={ht.source_ids} /></div>
      </Section>

      <Section kicker="Breakdowns">
        {(d.breakdowns as Rec[]).map((b) => {
          const items = (b.items ?? b.series) as Rec[];
          const numeric = b.items && b.items.length && b.items[0].value != null;
          const years = numeric ? [] : Object.keys(items[0]).filter((k) => k !== "label" && k !== "flag_iso");
          return (
            <Card key={b.id} style={{ marginBottom: 16 }}>
              <H3>{b.title}</H3>
              <div style={{ margin: "16px 0" }}>
                {numeric
                  ? <Bars rows={(b.items as Rec[]).map((i) => ({ label: i.label, value: i.value }))}
                          suffix={/percent/.test(String(b.unit ?? "")) ? "%" : ""} />
                  : <Table rows={items} cols={[{ key: "label", label: "" },
                      ...years.map((y) => ({ key: y, label: y, num: true }))]} />}
              </div>
              {b.note ? <Note>{b.note}</Note> : null}
              {b.scope ? <Note style={{ marginTop: 8 }}><strong>Scope.</strong> {b.scope}</Note> : null}
              <div style={{ marginTop: 12 }}><Cite ids={b.source_ids ?? [b.source_id]} /></div>
            </Card>
          );
        })}
      </Section>

      <Section kicker="Counting bodies">
        <Table rows={d.counting_bodies as Rec[]} cols={[
          { key: "id", label: "Body", render: (r) => <><strong>{r.id}</strong><span className="sub">{r.name}</span></> },
          { key: "scope", label: "Scope" },
          { key: "counts", label: "What it counts" },
        ]} />
      </Section>

      <Section kicker="Findings">
        {(d.findings as Rec[]).map((f) => (
          <Card key={f.id} style={{ marginBottom: 16 }}>
            <H3>{f.claim}</H3>
            <Note style={{ marginTop: 12 }}>{f.evidence}</Note>
            <div style={{ marginTop: 14 }}><Cite ids={f.source_ids} /></div>
          </Card>
        ))}
      </Section>
    </>
  );
}
