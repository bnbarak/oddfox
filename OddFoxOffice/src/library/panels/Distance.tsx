import { DB, tally, atDistance, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Table, Note, H1, Chips, Bars, Pie, Flag, Toggle, StackedArea } from "../../ui";

const BANDS = [4, 3, 2, 1, 0];

export function Distance({ proxComp, setProxComp }: { proxComp: string; setProxComp: (v: string) => void }) {
  const d = DB.marketPlayers as Rec;
  const all = d.records as Rec[];
  const pm = d.proximity_model as Rec;
  const scale = pm.scale as Record<string, string>;
  const bandLabel = (n: number) => `${n}/4 · ${scale[String(n)]}`;
  const three = atDistance(3);
  const missing = tally(three, (r) => {
    const ax = r.proximity_axes as Record<string, boolean>;
    return Object.keys(ax).filter((k) => !ax[k])[0] ?? "none";
  });
  const byCat = (d.categories as Rec[]).map((c) => ({
    label: c.name as string,
    value: all.filter((r) => (r.categories as string[]).includes(c.id as string)).length,
  })).filter((x) => x.value > 0);
  const xs = [...BANDS].reverse().map(bandLabel);
  const tones = ["calm", "cool", "warm", "hot", "paper", "cool", "warm", "calm", "hot"] as const;
  const groups = proxComp === "market"
    ? [{ k: "commercial", tone: "calm" }, { k: "both", tone: "cool" }, { k: "military", tone: "hot" }]
        .map((g) => ({ label: g.k, tone: g.tone as any,
          values: [...BANDS].reverse().map((n) => all.filter((r) => r.proximity === n && r.market === g.k).length) }))
    : (d.categories as Rec[]).map((c, i) => ({
        label: c.name as string, tone: tones[i % tones.length] as any,
        values: [...BANDS].reverse().map((n) => all.filter((r) => r.proximity === n && (r.categories as string[]).includes(c.id as string)).length),
      })).filter((s) => s.values.some((v) => v > 0));

  return (
    <>
      <H1>Distance from what we do</H1>
      <p className="of-lede">{pm.question}</p>

      <Section kicker="Shape of the field">
        <Grid cols={4}>
          <Cell><Stat value={all.length} label="companies catalogued" /></Cell>
          <Cell><Stat value={(d.categories as Rec[]).length} label="categories" /></Cell>
          <Cell><Stat value={tally(all, "country").length} label="countries" /></Cell>
          <Cell><Stat value={all.filter((r) => r.relation === "direct competitor").length} label="selling escort vessels today" /></Cell>
        </Grid>
      </Section>

      <Section kicker="Composition">
        <Grid cols={3}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>By category</div>
            <Pie items={byCat} centreLabel="ENTRIES" />
            <Note style={{ marginTop: 12 }}>Companies can sit in more than one category, so this sums above the company count.</Note></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>By relation</div>
            <Pie items={tally(all, "relation")} centreLabel="COMPANIES" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>By confidence</div>
            <Pie items={tally(all, "confidence")} centreLabel="COMPANIES" />
            <Note style={{ marginTop: 12 }}>Low means carried from a listing or general knowledge and still to be checked.</Note></Cell>
        </Grid>
      </Section>

      <Section kicker="Distance from what Seaworth does">
        <Note style={{ marginBottom: 20 }}><strong>{pm.question}</strong> {pm.note}</Note>
        <Grid cols={4}>
          <Cell><Stat value={all.filter((r) => r.proximity === 4).length} label="score 4 of 4" sub="same business" /></Cell>
          <Cell><Stat value={three.length} label="score 3 of 4" sub="one step away" /></Cell>
          <Cell><Stat value={missing.length === 1 ? missing[0].label : "—"}
                      label={missing.length === 1 ? "is the axis every one of them misses" : "axes missed"} /></Cell>
          <Cell><Stat value={all.filter((r) => (r.proximity as number) <= 1).length} label="score 1 or 0" sub="peripheral or supplier" /></Cell>
        </Grid>
        <Grid cols={2} style={{ marginTop: 26 }}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Companies by distance</div>
            <Bars rows={BANDS.map((n) => ({
              label: bandLabel(n), value: all.filter((r) => r.proximity === n).length,
              tone: (n === 3 ? "hot" : n === 2 ? "warm" : n === 1 ? "cool" : "") as any,
            }))} /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Which axis the closest {three.length} are missing</div>
            <Pie items={missing} centreLabel="AT 3/4" />
            <Note style={{ marginTop: 12 }}>Every company that comes closest fails on the same axis.</Note></Cell>
        </Grid>
      </Section>

      <Section kicker="Composition across the distance scale">
        <Toggle value={proxComp} onChange={setProxComp}
                options={[{ id: "category", label: "By what they sell" }, { id: "market", label: "By market" }]} />
        <StackedArea xLabels={xs} series={groups} height={340} label="composition by distance" />
        <Note style={{ marginTop: 16 }}>
          {proxComp === "category"
            ? "A company in several categories counts in each, so the stack can exceed the company count at that distance."
            : "Each company has one market, so these totals equal the company count at that distance."}
        </Note>
      </Section>

      <Section kicker={`The closest ${three.length}`}>
        <Table rows={[...three].sort((a, b) => (a.name as string).localeCompare(b.name as string))} cols={[
          { key: "name", label: "Company", render: (r) => <><Flag iso={r.country_iso} name={r.country} /> <strong style={{ marginLeft: 8 }}>{r.name}</strong></> },
          { key: "country", label: "Country" },
          { key: "mission", label: "Mission", render: (r) => <span className="of-note">{r.mission}</span> },
          { key: "has", label: "Has", render: (r) => <Chips tone="calm" items={Object.keys(r.proximity_axes).filter((k) => (r.proximity_axes as Rec)[k])} /> },
          { key: "miss", label: "Missing", render: (r) => <Chips tone="hot" items={Object.keys(r.proximity_axes).filter((k) => !(r.proximity_axes as Rec)[k])} /> },
        ]} />
      </Section>
    </>
  );
}
