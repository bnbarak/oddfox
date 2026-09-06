import { DB, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Table, Note, H1, H2, Card, Chip, Gap, Bars, Site } from "../../ui";

export function GTM() {
  const g = DB.gtm as unknown as Rec;
  const wb = g.who_buys as Rec;
  const tiers = g.tiers as Rec[];
  const totalTargets = tiers.reduce((a, t) => a + (t.targets as number), 0);

  return (
    <>
      <H1>Go to market</H1>
      <p className="of-lede">{g.description as string}</p>

      <Section kicker="Who buys, who does not">
        <Grid cols={2}>
          <Cell>
            <div className="of-kicker" style={{ marginBottom: 12 }}>Buys security</div>
            {(wb.buys as Rec[]).map((r) => (
              <div key={r.role as string} style={{ padding: "9px 0", borderBottom: "1px solid var(--line-soft)" }}>
                <strong style={{ fontSize: 13.5 }}>{r.role}</strong>
                <div className="of-note" style={{ marginTop: 4 }}>{r.why}</div>
              </div>
            ))}
          </Cell>
          <Cell>
            <div className="of-kicker" style={{ marginBottom: 12 }}>Do not target</div>
            {(wb.do_not_target as Rec[]).map((r) => (
              <div key={r.role as string} style={{ padding: "9px 0", borderBottom: "1px solid var(--line-soft)" }}>
                <strong style={{ fontSize: 13.5 }}>{r.role}</strong>
                <div className="of-note" style={{ marginTop: 4 }}>{r.why}</div>
              </div>
            ))}
          </Cell>
        </Grid>
        <Note style={{ marginTop: 16 }}>{wb.basis as string}</Note>
      </Section>

      <Section kicker="Priority order">
        <Grid cols={3} style={{ marginBottom: 20 }}>
          <Cell><Stat value={tiers.length} label="tiers" /></Cell>
          <Cell><Stat value={totalTargets} label="named targets" /></Cell>
          <Cell><Stat value="3,095" label="vessels reachable through tier 1" sub="five ship managers" /></Cell>
        </Grid>
        <Bars rows={tiers.map((t) => ({
          label: `${t.rank}. ${t.name}` as string, value: t.targets as number,
          tone: (t.rank as number) <= 2 ? "hot" : "cool",
        }))} />
      </Section>

      {tiers.map((t) => (
        <Section key={t.id as string} kicker={`Tier ${t.rank} — ${t.name}`}>
          <Card>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <H2>{t.name}</H2>
              <Chip tone={(t.rank as number) <= 2 ? "hot" : "cool"}>{t.targets as number} targets</Chip>
              <span className="of-src">{t.reach as string}</span>
            </div>
            <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.55 }}>{t.why as string}</div>
            <div style={{ marginTop: 12 }}>
              <div className="of-src">Basis</div>
              <div className="of-note" style={{ marginTop: 3 }}>{t.basis as string}</div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="of-src">Judgment</div>
              <div className="of-note" style={{ marginTop: 3 }}>{t.judgment as string}</div>
            </div>
          </Card>

          <Table rows={t.named as Rec[]} cols={[
            { key: "company", label: "Company", render: (r) => <strong>{r.company}</strong> },
            { key: "role", label: "Role / fleet", render: (r) => (
                <span className="of-note">{(r.role as string) ?? (r.fleet ? `${r.fleet} vessels` : "")}</span>) },
            { key: "vessel", label: "Vessel attacked", render: (r) => r.vessel ?? "—" },
            { key: "channel", label: "Channel", render: (r) => (
                r.channel ? (String(r.channel).includes(".") && !String(r.channel).includes(" ")
                  ? <Site url={`https://${r.channel}`} />
                  : <span className="of-note">{r.channel as string}</span>) : "—") },
            { key: "reachable", label: "Reachable", render: (r) => (
                r.reachable === undefined ? "—"
                  : r.reachable ? <Chip tone="calm">yes</Chip> : <Chip tone="warm">LinkedIn only</Chip>) },
            { key: "note", label: "Note", render: (r) => <span className="of-note">{r.note ?? ""}</span> },
          ]} />
          <Note style={{ marginTop: 14 }}><strong>Blocker: </strong>{t.blocker as string}</Note>
        </Section>
      ))}

      <Section kicker="Message angles">
        {(g.message_angles as Rec[]).map((a) => (
          <Card key={a.angle as string} style={{ marginBottom: 14 }}>
            <H2>{a.angle}</H2>
            <div style={{ marginTop: 12 }}>
              <div className="of-src">Basis</div>
              <div className="of-note" style={{ marginTop: 3 }}>{a.basis as string}</div>
            </div>
            {a.caveat ? <Note style={{ marginTop: 12 }}>{a.caveat as string}</Note> : null}
            <div style={{ marginTop: 12 }}>
              <div className="of-src">Use</div>
              <div style={{ marginTop: 3, fontSize: 13.5 }}>{a.use as string}</div>
            </div>
          </Card>
        ))}
      </Section>

      <Section kicker="Do not claim">
        {(g.do_not_claim as string[]).map((c) => (
          <div key={c} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 13.5 }}>
            <Chip tone="hot">no</Chip> <span style={{ marginLeft: 8 }}>{c}</span>
          </div>
        ))}
      </Section>

      <Section kicker="What blocks outreach today">
        {(g.gaps as string[]).map((x) => <Gap key={x}>{x}</Gap>)}
      </Section>
    </>
  );
}
