import { useState } from "react";
import { DB, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Note, H1, H2, Card, Chip, Site } from "../../ui";

const KIND: Record<string, any> = { published: "calm", derived: "cool", flagged: "hot" };

export function Stats() {
  const lib = DB.statsLibrary as unknown as Rec;
  const q = DB.questions as unknown as Rec;
  const rq = DB.riskQuant as unknown as Rec;
  const rows = lib.stats as Rec[];
  const [kind, setKind] = useState<string>("all");
  const shown = kind === "all" ? rows : rows.filter((r) => r.kind === kind);
  const counts = lib.counts as Rec;

  return (
    <>
      <H1>Stats library</H1>
      <p className="of-lede">{lib.description as string}</p>

      <Section kicker="What is in here">
        <Grid cols={4}>
          <Cell><Stat value={counts.total as number} label="statistics" /></Cell>
          <Cell><Stat value={counts.published as number} label="published" sub="stated in a source" /></Cell>
          <Cell><Stat value={(counts.derived as number) ?? 0} label="derived" sub="our arithmetic, method shown" /></Cell>
          <Cell><Stat value={(counts.flagged as number) ?? 0} label="flagged" sub="do not use externally" /></Cell>
        </Grid>
        <div style={{ display: "flex", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
          {["all", "published", "derived", "flagged"].map((k) => (
            <button key={k} className={`of-facet__b${kind === k ? " is-on" : ""}`} onClick={() => setKind(k)}>
              {k}<span className="of-facet__n">{k === "all" ? rows.length : rows.filter((r) => r.kind === k).length}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section kicker="Every number, with its source">
        <div className="of-matrix-wrap">
          <table className="of-matrix of-crm">
            <thead><tr>
              <th className="co">Statistic</th><th>Value</th><th>Period</th><th>Kind</th><th>Source</th><th>Note / method</th>
            </tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i}>
                  <td className="co"><span className="co-row"><span className="co-name">{r.stat}</span></span></td>
                  <td className="cell"><strong>{r.value}{r.unit ? ` ${r.unit}` : ""}</strong></td>
                  <td className="cell"><span className="of-num">{(r.period as string) ?? "—"}</span></td>
                  <td className="cell"><Chip tone={KIND[r.kind as string] ?? ""}>{r.kind}</Chip></td>
                  <td className="cell">
                    {((r.sources as Rec[]) ?? []).length
                      ? (r.sources as Rec[]).map((s) => (
                          <div key={s.id as string}><Site url={s.url as string} label={s.publisher as string} /></div>))
                      : <span className="of-note">own dataset</span>}
                  </td>
                  <td className="cell"><span className="of-note">{(r.method ?? r.note ?? "") as string}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note style={{ marginTop: 14 }}>
          {Object.entries(lib.legend as Rec).map(([k, v]) => `${k}: ${v}`).join("  ")}
        </Note>
      </Section>

      <Section kicker="Quantifying the risk">
        <p className="of-lede" style={{ marginTop: -6 }}>{rq.purpose as string}</p>
        <Grid cols={4}>
          <Cell><Stat value={`${(rq.step_1_attack_rate as Rec).result_pct}%`} label="chance a transit is attacked"
                      sub="Red Sea 2024, derived" /></Cell>
          <Cell><Stat value={`${(rq.step_2_severity as Rec).result_pct}%`} label="of attacks ended in total loss"
                      sub="named incidents only" /></Cell>
          <Cell><Stat value={`${(rq.step_3_expected_loss as Rec).result_pct}%`} label="expected loss per transit"
                      sub={`$${((rq.step_3_expected_loss as Rec).on_an_80m_hull_usd as number).toLocaleString()} on an $80m hull`} /></Cell>
          <Cell><Stat value={`${(rq.step_4_versus_the_premium as Rec).ratio_premium_to_expected_loss}x`}
                      label="premium versus expected loss" sub="where the margin is" /></Cell>
        </Grid>
        <Card style={{ marginTop: 20 }}>
          <H2>The honest problem</H2>
          <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>{rq.the_honest_problem as string}</div>
        </Card>
        <Grid cols={2} style={{ marginTop: 18 }}>
          <Cell>
            <div className="of-kicker" style={{ marginBottom: 10 }}>Why the gap might be real</div>
            {((rq.step_4_versus_the_premium as Rec).why_that_gap_might_be_real as string[]).map((x) => (
              <div key={x} style={{ padding: "7px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 13 }}>{x}</div>))}
          </Cell>
          <Cell>
            <div className="of-kicker" style={{ marginBottom: 10 }}>Why our number might be wrong</div>
            {((rq.step_4_versus_the_premium as Rec).why_our_number_might_be_wrong as string[]).map((x) => (
              <div key={x} style={{ padding: "7px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 13 }}>{x}</div>))}
          </Cell>
        </Grid>
      </Section>

      <Section kicker="What we still need to know">
        <Grid cols={4} style={{ marginBottom: 18 }}>
          {Object.entries(q.status_counts as Rec).map(([k, v]) => (
            <Cell key={k}><Stat value={v as number} label={k} /></Cell>
          ))}
        </Grid>
        {(q.domains as Rec[]).map((d) => (
          <Card key={d.domain as string} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <H2>{d.domain}</H2>
              {d.status === "parked" && <Chip tone="warm">parked</Chip>}
            </div>
            {(d.questions as Rec[]).map((x) => (
              <div key={x.question as string} style={{ padding: "9px 0", borderBottom: "1px solid var(--line-soft)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Chip tone={x.status === "answered" ? "calm" : x.status === "partial" ? "cool"
                            : x.status === "parked" ? "" : "hot"}>{x.status}</Chip>
                  <strong style={{ fontSize: 13.5 }}>{x.question}</strong>
                </div>
                <div className="of-note" style={{ marginTop: 5 }}>{x.what_we_know}</div>
                {x.status !== "answered" && (
                  <div className="of-src" style={{ marginTop: 4 }}>{x.how_to_answer} · {x.cost}</div>)}
              </div>
            ))}
          </Card>
        ))}
      </Section>
    </>
  );
}
