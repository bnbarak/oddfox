import { DB, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Note, Cite, ConfChip, H1, H2, Card, Chip, Gap, Bars, Flag,
         Matrix, Src, type MatrixRow } from "../../ui";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, LabelList, Cell as RCell } from "recharts";
import { C, axisTick, gridProps, OFTooltip, Frame } from "../../ui/chartTheme";

const MTONE: Record<string, any> = { military: "hot", commercial: "calm", both: "cool" };
const MCOLOR: Record<string, string> = { military: C.hot, commercial: C.calm, both: C.cool };

export function Platforms() {
  const d = DB.platforms as Rec;
  const cov = d.spec_coverage as Record<string, number>;
  const R = d.records as Rec[];
  const pts = R.filter((r) => r.length_m && r.max_speed_kn);

  const cols = [{ label: "Market" }, { label: "Length m" }, { label: "Max kn" }, { label: "Range nm" },
                { label: "Endurance" }, { label: "Sea state" }, { label: "Payload" },
                { label: "Propulsion" }, { label: "Armed" }];
  const mrows: MatrixRow[] = [...R].sort((a, b) => ((b.length_m as number) ?? 0) - ((a.length_m as number) ?? 0))
    .map((r) => ({
      label: r.platform as string, sub: r.maker as string,
      cells: [
        { text: (r.market as string) ?? "" },
        { text: r.length_m != null ? String(r.length_m) : "", num: true },
        { text: r.max_speed_kn != null ? String(r.max_speed_kn) : "", num: true },
        { text: r.range_nm != null ? String(r.range_nm) : "", num: true },
        { text: (r.endurance as string) ?? "" }, { text: (r.sea_state as string) ?? "" },
        { text: (r.payload as string) ?? "" }, { text: (r.propulsion as string) ?? "" },
        { text: (r.armed as string) ?? "" },
      ],
    }));

  return (
    <>
      <H1>Platform specifications</H1>
      <p className="of-lede">{d.description}</p>

      <Section kicker="Coverage">
        <Grid cols={4}>
          <Cell><Stat value={cov.platforms} label="platforms with specifications"
                      sub={`of ${cov.named_platforms_in_company_data} named in the company data`} /></Cell>
          <Cell><Stat value={cov.length_m} label="publish a length" /></Cell>
          <Cell><Stat value={cov.range_nm} label="publish a range" sub="the field most often withheld" /></Cell>
          <Cell><Stat value={cov.sea_state} label="publish a sea state" /></Cell>
        </Grid>
        <div style={{ marginTop: 26 }}>
          <Bars max={cov.platforms} rows={[
            { label: "Length", value: cov.length_m }, { label: "Max speed", value: cov.max_speed_kn },
            { label: "Armament stated", value: cov.armed }, { label: "Propulsion", value: cov.propulsion },
            { label: "Payload", value: cov.payload }, { label: "Endurance", value: cov.endurance },
            { label: "Sea state", value: cov.sea_state }, { label: "Range", value: cov.range_nm },
            { label: "Cruise speed", value: cov.cruise_speed_kn },
          ].map((x) => ({ ...x, tone: (x.value < 20 ? "hot" : x.value < 30 ? "warm" : "calm") as any }))} />
          <Note style={{ marginTop: 16 }}>
            Bars are out of {cov.platforms}. Red fields are published by fewer than half the makers,
            which is why a single capability ranking is not possible.
          </Note>
        </div>
      </Section>

      <Section kicker="Size against speed, where both are published">
        <Frame height={380}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 10 }}>
            <CartesianGrid {...gridProps} />
            <XAxis type="number" dataKey="length_m" name="length" unit=" m" scale="sqrt"
                   tick={axisTick} axisLine={{ stroke: C.axis }} tickLine={false}
                   ticks={[1, 5, 10, 20, 40, 80]} domain={[0, "dataMax"]}
                   label={{ value: "length overall (m, √ scale)", position: "insideBottom", offset: -18, fill: C.fog, fontSize: 11 }} />
            <YAxis type="number" dataKey="max_speed_kn" name="max speed" unit=" kn"
                   tick={axisTick} axisLine={false} tickLine={false} width={44} />
            <OFTooltip />
            <Scatter data={pts as any} isAnimationActive={false}>
              {pts.map((r, i) => <RCell key={i} fill={MCOLOR[r.market as string] ?? C.paper} fillOpacity={0.55}
                                        stroke={MCOLOR[r.market as string] ?? C.paper} strokeWidth={1.5} />)}
              <LabelList dataKey="platform" position="right"
                         style={{ fill: C.paper, fontFamily: "var(--mono)", fontSize: 10 }} />
            </Scatter>
          </ScatterChart>
        </Frame>
        <div className="of-maplegend">
          <span className="k"><span className="of-dot calm" />commercial</span>
          <span className="k"><span className="of-dot hot" />military</span>
          <span className="k"><span className="of-dot cool" />both</span>
        </div>
        <Note style={{ marginTop: 12 }}>
          {pts.length} of {R.length} platforms publish both figures. Horizontal axis is square-root
          scaled so the small craft stay readable next to the 78 m Armada.
        </Note>
      </Section>

      <Section kicker="Specification matrix">
        <Matrix rows={mrows} cols={cols} corner="Platform" />
        <Note style={{ marginTop: 16 }}>
          Empty circles are fields the maker does not publish, not zeros. Sorted longest first.
          Scroll horizontally; the platform column stays fixed.
        </Note>
      </Section>

      <Section kicker="Detail">
        {[...R].sort((a, b) => (a.maker as string).localeCompare(b.maker as string)).map((r) => {
          const fields: [string, any][] = [
            ["Role", r.role], ["Length", r.length_m ? `${r.length_m} m` : null], ["Length note", r.length_note],
            ["Max speed", r.max_speed_kn ? `${r.max_speed_kn} kn` : null],
            ["Cruise", r.cruise_speed_kn ? `${r.cruise_speed_kn} kn` : null],
            ["Range", r.range_nm ? `${r.range_nm} nm` : null], ["Endurance", r.endurance],
            ["Payload", r.payload], ["Sea state", r.sea_state], ["Propulsion", r.propulsion], ["Armed", r.armed],
          ];
          return (
            <Card key={r.id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Flag iso={r.country_iso} name={r.country_iso} large size={32} />
                <H2>{r.platform}</H2>
                <span className="of-src">{r.maker}</span>
                <Chip tone={MTONE[r.market as string] ?? ""}>{r.market}</Chip>
                <ConfChip level={r.confidence} />
              </div>
              <div style={{ marginTop: 14 }}>
                {fields.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 16, padding: "5px 0", fontSize: 13.5, lineHeight: 1.5 }}>
                    <div className="of-src" style={{ minWidth: 96, flexShrink: 0 }}>{k}</div><div>{v}</div>
                  </div>
                ))}
              </div>
              {r.note && <div className="of-callout" style={{ marginTop: 14 }}>{r.note}</div>}
              <Src style={{ marginTop: 12 }}>Retrieved {r.retrieved}</Src>
              <div style={{ marginTop: 8 }}><Cite ids={r.source_ids} /></div>
            </Card>
          );
        })}
      </Section>

      <Section kicker="Gaps">
        {(d.gaps as string[]).map((g, i) => <div key={i} style={{ marginBottom: 14 }}><Gap>{g}</Gap></div>)}
      </Section>
    </>
  );
}
