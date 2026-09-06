import { DB, pctChange, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Table, Note, Cite, ConfChip, H1, H2, H3, Card, Chip,
         Gap, Columns, MultiLine } from "../../ui";

export function Economics() {
  const d = DB.riskEconomics as Rec;
  const re = DB.routeEconomics as Rec;
  const w = d.how_it_works as Rec;
  const ps = d.premium_series as Rec;
  const alt = re.the_alternative as Rec;
  const sub = re.the_substitute as Rec;
  const ep = re.escort_precedent as Rec | undefined;
  const st = re.suez_traffic as Rec;
  const rec = st.recovery_2026 as Rec;

  return (
    <>
      <H1>Economics</H1>
      <p className="of-lede">{d.description}</p>

      <Section kicker="War risk premium over time, by area">
        <MultiLine series={ps.series as any} height={340} logY label="war risk premium by area over time" />
        <Note style={{ marginTop: 16 }}>{ps.note}</Note>
        <div style={{ marginTop: 20 }}>
          <Table rows={ps.undated_reference as Rec[]} cols={[
            { key: "area", label: "Undated reference" },
            { key: "period", label: "Period" },
            { key: "label", label: "% of hull", num: true, render: (r) => <strong>{r.label}</strong> },
            { key: "confidence", label: "Confidence", render: (r) => <ConfChip level={r.confidence} /> },
          ]} />
        </div>
      </Section>

      <Section kicker="How it is priced">
        <Grid cols={4}>
          {[["Basis", w.basis], ["Quoting", w.quoting], ["Trigger", w.trigger], ["Who pays", w.who_pays]].map(([k, v]) => (
            <Cell key={k as string}>
              <div className="of-kicker">{k as string}</div>
              <Note style={{ marginTop: 10 }}>{v as string}</Note>
            </Cell>
          ))}
        </Grid>
      </Section>

      <Section kicker="All premium points">
        <Table rows={d.premiums as Rec[]} cols={[
          { key: "area", label: "Area" }, { key: "period", label: "Period" },
          { key: "label", label: "% of hull", num: true, render: (r) => <strong>{r.label}</strong> },
          { key: "confidence", label: "Confidence", render: (r) => <ConfChip level={r.confidence} /> },
          { key: "note", label: "Note", render: (r) => <span className="of-note">{r.note ?? ""}</span> },
        ]} />
      </Section>

      <Section kicker="Traffic response">
        {(d.traffic_effects as Rec[]).map((t) => (
          <Card key={t.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <H2>{t.area}</H2><span className="of-src of-num">{t.date}</span><ConfChip level={t.confidence} />
            </div>
            <div style={{ marginTop: 16 }}>
              <Stat value={`${t.from} → ${t.to}`} label={t.metric as string} delta={t.change_pct as number} />
            </div>
            {t.consequence && <Note style={{ marginTop: 14 }}>{t.consequence}</Note>}
            {t.note && <Note style={{ marginTop: 8 }}>{t.note}</Note>}
            <div style={{ marginTop: 12 }}><Cite ids={t.source_ids} /></div>
          </Card>
        ))}
      </Section>

      <Section kicker="Routing around the risk — Cape of Good Hope">
        <Table rows={[...(alt.penalties as Rec[]), ...((alt.what_it_avoids as Rec[]) ?? [])]} cols={[
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value", render: (r) => <strong>{r.value}</strong> },
          { key: "confidence", label: "Confidence", render: (r) => <ConfChip level={r.confidence} /> },
          { key: "note", label: "Note", render: (r) => <span className="of-note">{r.note ?? ""}</span> },
        ]} />
      </Section>

      <Section kicker="Armed guards, published pricing">
        <Gap>{sub.vintage_warning}</Gap>
        <div style={{ marginTop: 22 }}>
          <Table rows={sub.prices as Rec[]} cols={[
            { key: "item", label: "What" },
            { key: "value", label: "Price", render: (r) => <strong>{r.value}</strong> },
            { key: "period", label: "Period" },
            { key: "note", label: "Note", render: (r) => <span className="of-note">{r.note ?? ""}</span> },
          ]} />
        </div>
        <Card style={{ marginTop: 20 }}>
          <H3>Legal and operational friction</H3>
          <div style={{ marginTop: 12 }}>
            {(sub.friction as string[]).map((f) => (
              <div key={f} className="of-note" style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>{f}</div>
            ))}
          </div>
        </Card>
        <div style={{ marginTop: 14 }}><Cite ids={sub.source_ids} /></div>
      </Section>

      {ep && (
        <Section kicker="Convoy escort precedent">
          <Card>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <H2>{ep.name}</H2><Chip tone="warm">{ep.period}</Chip><ConfChip level={ep.confidence} />
            </div>
            <div style={{ marginTop: 16 }}>
              {[["HQ", ep.hq], ["Model", ep.model], ["Price", ep.price]].map(([k, v]) => (
                <div key={k as string} style={{ display: "flex", gap: 16, padding: "6px 0", fontSize: 13.5, lineHeight: 1.5 }}>
                  <div className="of-src" style={{ minWidth: 70, flexShrink: 0 }}>{k as string}</div><div>{v as string}</div>
                </div>
              ))}
            </div>
            <Grid cols={3} style={{ marginTop: 22 }}>
              <Cell><Stat value={`$${((ep.derived as Rec).cost_per_vessel_per_transit_usd as number).toLocaleString()}`}
                          label="per protected vessel per transit" sub={(ep.derived as Rec).how as string} /></Cell>
              <Cell><Stat value="$50-60k" label="per transit, embarked armed team" sub="2012 figures" /></Cell>
              <Cell><Stat value={(ep.derived as Rec).ratio as string} label="ratio" sub="derived, not published" /></Cell>
            </Grid>
            <Gap>{(ep.derived as Rec).caveat as string}</Gap>
            <div style={{ marginTop: 14 }}><Cite ids={ep.source_ids} /></div>
          </Card>
        </Section>
      )}

      <Section kicker="Suez Canal revenue">
        <Columns height={230} showValues label="Suez revenue USD bn"
                 points={[
                   ...(st.points as Rec[]).filter((p) => p.value_usd_bn && p.metric === "Suez toll revenue")
                     .map((p) => ({ label: p.period as string, value: p.value_usd_bn as number, tone: "cool" as const })),
                   ...((st.imf_projection as Rec).points as Rec[])
                     .map((p) => ({ label: `${p.period} (proj)`, value: p.value_usd_bn as number, tone: "warm" as const })),
                 ]} />
        <Note style={{ marginTop: 14 }}>Blue is reported. Amber is the IMF projection carried by the Egyptian State Information Service.</Note>
        <Grid cols={3} style={{ marginTop: 24 }}>
          <Cell><Stat value={(rec.vessels_ytd as number).toLocaleString()} label="vessels year to date"
                      sub={`was ${(rec.vessels_ytd_prior as number).toLocaleString()}`}
                      delta={pctChange(rec.vessels_ytd_prior as number, rec.vessels_ytd as number)} /></Cell>
          <Cell><Stat value={`${rec.net_tonnage_ytd_m}M`} label="net tons year to date"
                      sub={`was ${rec.net_tonnage_ytd_prior_m}M`}
                      delta={pctChange(rec.net_tonnage_ytd_prior_m as number, rec.net_tonnage_ytd_m as number)} /></Cell>
          <Cell><Stat value={`$${rec.revenue_ytd_usd_m}M`} label="revenue year to date"
                      sub={`was $${rec.revenue_ytd_prior_usd_m}M`}
                      delta={pctChange(rec.revenue_ytd_prior_usd_m as number, rec.revenue_ytd_usd_m as number)} /></Cell>
        </Grid>
        <Note style={{ marginTop: 16 }}>{rec.trigger}</Note>
        <div style={{ marginTop: 14 }}><Cite ids={rec.source_ids} /></div>
      </Section>

      <Section kicker="Open questions">
        {[...((d.open_questions as string[]) ?? []), ...((re.open_questions as string[]) ?? [])].map((q, i) => (
          <div key={i} style={{ marginBottom: 14 }}><Gap>{q}</Gap></div>
        ))}
      </Section>
    </>
  );
}
