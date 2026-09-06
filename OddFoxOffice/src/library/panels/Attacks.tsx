import { DB, tally, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Table, Note, Cite, ConfChip, H1, H2, H3, Card, Chip,
         Chips, Flag, Sub, Pie, Bars, Columns, LineChart } from "../../ui";

const logTone = (o: string) =>
  /hijack/.test(o) ? "hot" : /repelled|failed|not boarded/.test(o) ? "calm"
    : o === "nil return" ? "cool" : "warm";

const incTone = (o: string) =>
  /sunk/.test(o) ? "hot" : /recovered|released/.test(o) ? "calm" : "warm";

export function Attacks() {
  const d = DB.tactics as Rec;
  const alog = DB.attackLog as Rec;
  const ht = DB.houthiTimeline as Rec;
  const inc = DB.incidents as Rec;

  const p = alog.patterns_2026_h1 as Rec;
  const dl = d.defence_layers as Rec;
  const sunk = (ht.outcomes as Rec[]).find((o) => o.label === "sunk")!;
  const flags = ht.flags as Rec[];
  const incRows = inc.records as Rec[];
  const byYear = tally(incRows, (r) => (r.date as string).slice(0, 4))
    .sort((a, b) => (a.label < b.label ? -1 : 1));

  return (
    <>
      <H1>How ships are attacked</H1>
      <p className="of-lede">{d.description}</p>

      {/* ---------- what the most recent reporting period looks like ---------- */}
      <Section kicker="IMB H1 2026 pattern">
        <Grid cols={4}>
          <Cell><Stat value={p.total_incidents} label="incidents worldwide" sub="lowest H1 since 1992" /></Cell>
          <Cell><Stat value={`${p.success_rate_pct}%`} label="boarded or hijacked" sub={p.attacks_at_anchor as string} /></Cell>
          <Cell><Stat value={p.crew_affected} label="seafarers affected" sub={`${(p.crew_breakdown as Rec[])[0].value} taken hostage`} /></Cell>
          <Cell><Stat value={`${p.somali_share_of_hostages_pct}%`} label="of hostages, Somali groups" /></Cell>
        </Grid>
        <Grid cols={3} style={{ marginTop: 26 }}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Outcome</div>
            <Pie items={p.outcomes as any} centreLabel="INCIDENTS" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Crew affected</div>
            <Pie items={p.crew_breakdown as any} centreLabel="CREW" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Vessel type targeted</div>
            <Pie items={p.target_types as any} centreLabel="VESSELS" />
            <Note style={{ marginTop: 12 }}>{p.target_note}</Note></Cell>
        </Grid>
        <Note style={{ marginTop: 18 }}>{p.success_rate_note}</Note>
        <div style={{ marginTop: 14 }}><Cite ids={p.source_ids} /></div>
      </Section>

      {/* ---------- the models ---------- */}
      <Section kicker="Threat models">
        <Grid cols={3} style={{ marginBottom: 26 }}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Threat model by platform count</div>
            <Pie centreLabel="PLATFORMS" items={(d.threat_models as Rec[]).map((m) => ({
              label: m.name as string, value: (m.platforms ?? []).length }))} /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Named incidents by outcome</div>
            <Pie items={tally(incRows, "outcome")} centreLabel="INCIDENTS" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Named incidents by actor</div>
            <Pie items={tally(incRows, "actor")} centreLabel="INCIDENTS" /></Cell>
        </Grid>

        {(d.threat_models as Rec[]).map((m) => {
          const rows: [string, any][] = [
            ["Intent", m.intent], ["Status 2026", m.status_2026], ["Organisation", m.organisation],
            ["Range", m.range], ["Approach", m.approach], ["Timing", m.timing],
            ["Weapon use", m.weapon_use], ["Boarding", m.boarding_method], ["Targeting", m.targeting_logic],
            ["Who they take", m.who_they_take], ["What they take", m.what_they_take],
            ["Target profile", m.target_profile], ["Crew treatment", m.treatment_of_crew],
            ["Severity", m.severity], ["Reporting", m.reporting_body],
          ];
          return (
            <Card key={m.id} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <H2>{m.name}</H2><ConfChip level={m.confidence} />
              </div>
              <div style={{ marginTop: 16 }}>
                {rows.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 16, padding: "6px 0", fontSize: 13.5, lineHeight: 1.5 }}>
                    <div className="of-src" style={{ minWidth: 112, flexShrink: 0 }}>{k}</div><div>{v}</div>
                  </div>
                ))}
              </div>
              {m.platforms && (
                <div style={{ marginTop: 18 }}>
                  <div className="of-kicker" style={{ marginBottom: 8 }}>Platforms</div>
                  {(m.platforms as Rec[]).map((pl) => (
                    <div key={pl.type} style={{ padding: "9px 0", borderBottom: "1px solid var(--line-soft)" }}>
                      <strong style={{ fontSize: 13.5 }}>{pl.type}</strong>
                      <div className="of-note" style={{ marginTop: 4 }}>{pl.detail}</div>
                    </div>
                  ))}
                </div>
              )}
              {m.weapons && <div style={{ marginTop: 18 }}><div className="of-kicker" style={{ marginBottom: 8 }}>Weapons</div><Chips items={m.weapons} tone="hot" /></div>}
              {m.vulnerability_factors && <div style={{ marginTop: 16 }}><div className="of-kicker" style={{ marginBottom: 8 }}>Vulnerability factors</div><Chips items={m.vulnerability_factors} tone="warm" /></div>}
              {m.defeated_by && <div style={{ marginTop: 16 }}><div className="of-kicker" style={{ marginBottom: 8 }}>Defeated by</div><Chips items={m.defeated_by} tone="calm" /></div>}
              {m.not_defeated_by && <div style={{ marginTop: 16 }}><div className="of-kicker" style={{ marginBottom: 8 }}>Not defeated by</div><Chips items={m.not_defeated_by} tone="hot" /></div>}
              {m.note && <Note style={{ marginTop: 16 }}>{m.note}</Note>}
              <div style={{ marginTop: 14 }}><Cite ids={m.source_ids} /></div>
            </Card>
          );
        })}
      </Section>

      <Section kicker="Defence layers">
        <Grid cols={3} style={{ marginBottom: 24 }}>
          {(dl.layers as Rec[]).map((L) => (
            <Cell key={L.layer}>
              <div className="of-kicker" style={{ marginBottom: 12 }}>{L.layer}</div>
              <Pie donut={false} label={`${L.layer} measures`}
                   items={(L.measures as Rec[]).map((m) => ({ label: m.name as string, value: 1 }))} />
            </Cell>
          ))}
        </Grid>
        <Note style={{ marginBottom: 22 }}>{dl.framework}</Note>
        {(dl.layers as Rec[]).map((L) => (
          <Card key={L.layer} style={{ marginBottom: 16 }}>
            <H3>{L.layer} layer</H3>
            <div style={{ marginTop: 14 }}>
              {(L.measures as Rec[]).map((m) => (
                <div key={m.name} style={{ padding: "11px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <strong style={{ fontSize: 13.5 }}>{m.name}</strong>
                  <div className="of-note" style={{ marginTop: 5 }}>{m.detail}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
        <Card>
          <H3>Operational practice</H3>
          <div style={{ marginTop: 12 }}>
            {(dl.operational_practice as string[]).map((o) => (
              <div key={o} className="of-note" style={{ padding: "9px 0", borderBottom: "1px solid var(--line-soft)" }}>{o}</div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}><Cite ids={dl.source_ids} /></div>
        </Card>
      </Section>

      <Section kicker="Transit corridors">
        <Table rows={d.transit_corridors as Rec[]} cols={[
          { key: "name", label: "Corridor", render: (r) => <strong>{r.name}</strong> },
          { key: "detail", label: "What it is", render: (r) => <span className="of-note">{r.detail}</span> },
        ]} />
      </Section>

      {/* ---------- the logs ---------- */}
      <Section kicker={`Houthi campaign, ${(ht.date_range as string[])[0]} to ${(ht.date_range as string[])[1]}`}>
        <Grid cols={4} style={{ marginBottom: 24 }}>
          <Cell><Stat value={ht.count} label="attacks recorded" /></Cell>
          <Cell><Stat value={sunk.value} label="vessels sunk" /></Cell>
          <Cell><Stat value={flags.length} label="distinct flags attacked" /></Cell>
          <Cell><Stat value={flags[0].value} label={`attacks on ${flags[0].flag}-flagged ships`} sub="most-hit flag" /></Cell>
        </Grid>
        <LineChart height={240} labelEvery={3}
                   points={(ht.monthly as Rec[]).map((m) => ({ label: m.month, value: m.count }))} />
        <Grid cols={2} style={{ marginTop: 26 }}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Outcome</div>
            <Pie items={ht.outcomes as any} centreLabel="ATTACKS" /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Flags most attacked</div>
            <Bars max={flags[0].value as number} rows={flags.slice(0, 10).map((f) => ({
              label: <><Flag iso={f.flag_iso} name={f.flag} /> {f.flag}</>, value: f.value,
            }))} /></Cell>
        </Grid>
        <div style={{ marginTop: 16 }}><ConfChip level={ht.confidence as string} /> <Cite ids={ht.source_ids} /></div>
      </Section>

      <Section kicker="Full Houthi timeline">
        <Table rows={ht.entries as Rec[]} cols={[
          { key: "date", label: "Date", render: (r) => <span className="of-num">{r.date}</span> },
          { key: "vessel", label: "Vessel", render: (r) => <strong>{r.vessel}</strong> },
          { key: "flag", label: "Flag", render: (r) => <><Flag iso={r.flag_iso} name={r.flag} /> <span style={{ marginLeft: 6 }}>{r.flag}</span></> },
          { key: "method", label: "Method", render: (r) => <span className="of-note">{r.method}</span> },
          { key: "outcome", label: "Outcome", render: (r) => (
              <Chip tone={(r.outcome === "sunk" ? "hot" : r.outcome === "captured" ? "warm"
                : /unharmed/.test(r.outcome) ? "calm" : r.outcome === "unknown" ? "" : "warm") as any}>{r.outcome}</Chip>) },
        ]} />
      </Section>

      <Section kicker="Named incidents by year">
        <Columns height={180} showValues label="named incidents by year"
                 points={byYear.map((x) => ({ label: x.label, value: x.value, tone: "cool" as const }))} />
        <Table rows={incRows} cols={[
          { key: "date", label: "Date", render: (r) => <span className="of-num">{r.date}</span> },
          { key: "vessel", label: "Vessel", render: (r) => <><strong>{r.vessel.name}</strong><Sub>{r.vessel.type ?? ""}</Sub></> },
          { key: "flag", label: "Flag", render: (r) => <><Flag iso={r.vessel.flag_iso} name={r.vessel.flag} /> <span style={{ marginLeft: 6 }}>{r.vessel.flag}</span></> },
          { key: "actor", label: "Actor" },
          { key: "outcome", label: "Outcome", render: (r) => <Chip tone={incTone(r.outcome) as any}>{r.outcome}</Chip> },
        ]} />
      </Section>

      <Section kicker="Named incidents in detail">
        {[...incRows].reverse().map((r) => {
          const fields: [string, any][] = [
            ["Type", r.vessel.type], ["Actor", r.actor], ["Method", r.method], ["Voyage", r.voyage],
            ["Cargo", r.cargo], ["Position", r.position_note], ["Crew", r.crew_effect],
            ["Escort", r.escort], ["Response", r.response], ["Date note", r.date_note],
          ];
          return (
            <Card key={r.id} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span className="of-num of-src">{r.date}</span>
                <Flag iso={r.vessel.flag_iso} name={r.vessel.flag} large size={32} />
                <H2>{r.vessel.name}</H2>
                <Chip tone={incTone(r.outcome) as any}>{r.outcome}</Chip>
                <ConfChip level={r.confidence} />
              </div>
              <div style={{ marginTop: 16 }}>
                {fields.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 14, padding: "5px 0", fontSize: 13.5, lineHeight: 1.5 }}>
                    <div className="of-src" style={{ minWidth: 82, flexShrink: 0 }}>{k}</div><div>{v}</div>
                  </div>
                ))}
              </div>
              {r.ownership_chain && (
                <Card style={{ marginTop: 16 }}>
                  <div className="of-kicker" style={{ marginBottom: 12 }}>Ownership chain</div>
                  {Object.entries(r.ownership_chain as Rec).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 14, padding: "6px 0", fontSize: 13.5 }}>
                      <div className="of-src" style={{ minWidth: 130 }}>{k.replace(/_/g, " ")}</div>
                      <div>{String(v)}</div>
                    </div>
                  ))}
                </Card>
              )}
              <div style={{ marginTop: 14 }}><Cite ids={r.source_ids} /></div>
            </Card>
          );
        })}
      </Section>

      <Section kicker="Reported entries">
        {(alog.entries as Rec[]).map((e) => {
          const fields: [string, any][] = [
            ["Position", e.position], ["Vessel", e.vessel], ["Attackers", e.attackers], ["Event", e.event],
            ...(e.closest_approach_m != null ? [["Closest", `${e.closest_approach_m} metres`] as [string, any]] : []),
          ];
          return (
            <Card key={e.id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="of-num of-src">{e.date}</span>
                <Chip tone="solid">{e.reported_by}</Chip>
                {e.ref && <span className="of-src">{e.ref}</span>}
                <Chip tone={logTone(e.outcome) as any}>{e.outcome}</Chip>
                {e.armed_team_aboard && <Chip tone="calm">armed team aboard</Chip>}
              </div>
              <div style={{ marginTop: 14 }}>
                {fields.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 16, padding: "5px 0", fontSize: 13.5, lineHeight: 1.5 }}>
                    <div className="of-src" style={{ minWidth: 82, flexShrink: 0 }}>{k}</div><div>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}><Cite ids={e.source_ids} /></div>
            </Card>
          );
        })}
      </Section>

      <Section kicker="Live feeds">
        <Table rows={alog.feeds as Rec[]} cols={[
          { key: "name", label: "Feed", render: (r) => (
              <><a className="of-link" href={r.url} target="_blank" rel="noopener"><strong>{r.name}</strong></a><span className="sub">{r.area}</span></>) },
          { key: "cadence", label: "Cadence" },
          { key: "format", label: "Format" },
          { key: "machine_readable", label: "Machine readable", render: (r) => (
              r.machine_readable ? <Chip tone="calm">yes</Chip> : <Chip tone="warm">no</Chip>) },
          { key: "note", label: "Note", render: (r) => <span className="of-note">{r.note ?? r.access ?? ""}</span> },
        ]} />
      </Section>
    </>
  );
}
