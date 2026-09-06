import { DB, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Note, Cite, ConfChip, H1, Bars, Columns, Pie, WorldMap, Flag, MultiLine } from "../../ui";

export function History() {
  const d = DB.piracyHistory as Rec;
  const ds = d.distance_from_shore_km as Rec;
  const byCountry = d.by_country as Rec[];
  const maxc = byCountry[0].value as number;
  const tones = ["hot", "warm", "cool", "calm", ""] as const;

  return (
    <>
      <H1>Reported attacks, 1993–2020</H1>
      <p className="of-lede">{d.description}</p>

      <Section kicker="Scale">
        <Grid cols={4}>
          <Cell><Stat value={(d.count as number).toLocaleString()} label="geocoded attacks" sub="1993 to 2020" /></Cell>
          <Cell><Stat value={[...(d.by_year as Rec[])].sort((a, b) => b.value - a.value)[0].value}
                      label="attacks in the peak year"
                      sub={[...(d.by_year as Rec[])].sort((a, b) => b.value - a.value)[0].label} /></Cell>
          <Cell><Stat value={`${ds.median} km`} label="median distance from shore" sub="half of all attacks were closer in" /></Cell>
          <Cell><Stat value={(d.grid as Rec).cells.length} label="occupied grid cells" sub="2° bins" /></Cell>
        </Grid>
      </Section>

      <Section kicker="Where, 28 years of attacks">
        <WorldMap world heat label="attack density, 2 degree bins"
                  points={((d.grid as Rec).cells as Rec[]).map((c) => ({ name: "", coords: c.coords, count: c.count }))} />
        <Note style={{ marginTop: 14 }}>{(d.grid as Rec).note} Circle area is proportional to the number of attacks in the cell.</Note>
        <div style={{ marginTop: 12 }}><Cite ids={d.source_ids} /></div>
      </Section>

      <Section kicker="Attacks per year">
        <Columns height={260} label="attacks per year"
                 points={(d.by_year as Rec[]).map((y) => ({
                   label: y.label, value: y.value,
                   tone: (y.value >= 350 ? "hot" : y.value >= 200 ? "warm" : "") as any,
                 }))} />
      </Section>

      <Section kicker="By region, per year">
        <MultiLine height={340} logY={false} label="attacks per year by region"
                   series={(d.by_region_year as Rec[]).map((r, i) => ({
                     area: r.region as string, tone: tones[i % tones.length] as any,
                     points: (r.points as Rec[]).map((p) => ({
                       date: `${p.label}-07-01`, low: p.value, high: p.value, label: String(p.value),
                     })),
                   }))} />
      </Section>

      <Section kicker="How far from shore">
        <Grid cols={2}>
          <Cell>
            <div className="of-kicker" style={{ marginBottom: 14 }}>Distance bands</div>
            <Pie items={ds.bands as Rec[] as any} centreLabel="ATTACKS" />
          </Cell>
          <Cell>
            <div className="of-kicker" style={{ marginBottom: 14 }}>Percentiles, km from shore</div>
            <Bars suffix=" km" rows={[
              { label: "median", value: ds.median }, { label: "75th percentile", value: ds.p75 },
              { label: "90th percentile", value: ds.p90 }, { label: "95th percentile", value: ds.p95 },
            ]} />
            <Note style={{ marginTop: 16 }}>Furthest recorded: {ds.max} km.</Note>
            <Note style={{ marginTop: 8 }}>{ds.note}</Note>
          </Cell>
        </Grid>
      </Section>

      <Section kicker="Composition">
        <Grid cols={3}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Attack type</div>
            <Pie items={d.by_attack_type as any} centreLabel="ATTACKS" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Vessel status</div>
            <Pie items={d.by_vessel_status as any} centreLabel="ATTACKS" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Vessel type</div>
            <Pie items={(d.by_vessel_type as Rec[]).slice(0, 7) as any} centreLabel="ATTACKS" /></Cell>
        </Grid>
      </Section>

      <Section kicker="Nearest country">
        <Bars max={maxc} rows={byCountry.map((c) => ({
          label: <><Flag iso={c.flag_iso} name={c.label} /> {c.label}</>, value: c.value,
        }))} />
        <Note style={{ marginTop: 16 }}>Nearest coastal state to the attack position, not the flag of the ship attacked.</Note>
        <div style={{ marginTop: 12 }}><ConfChip level={d.confidence as string} /> <Cite ids={d.source_ids} /></div>
      </Section>
    </>
  );
}
