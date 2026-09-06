import { DB, source, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Table, Note, Cite, H1, H2, H3, Card, Chip, Chips,
         Flag, Star, Site, Sub, Gap } from "../../ui";

/** Per-company dossier. One JSON file per competitor; this renders whichever are loaded. */
export function Dossier() {
  const list = DB.dossiers as unknown as Rec[];
  if (!list.length) return <><H1>Dossiers</H1><Note>No company dossiers loaded.</Note></>;

  return (
    <>
      <H1>Company dossiers</H1>
      <p className="of-lede">
        One JSON file per competitor under data/json/companies/. Every field carries the source it came
        from and the date it was retrieved; absent facts are listed as gaps rather than estimated.
      </p>

      {list.map((d) => {
        const id = d.identity as Rec;
        const cl = d.classification as Rec;
        const fu = d.funding as Rec;
        const rounds = (fu?.rounds as Rec[]) ?? [];
        const axes = (cl?.axes as Record<string, boolean>) ?? {};
        const ev = (cl?.axis_evidence as Record<string, string>) ?? {};
        const re = cl?.reclassified as Rec | undefined;

        return (
          <div key={d.id as string}>
            <Section kicker={`${d.name} — identity`}>
              <Card>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <Flag iso={id.country_iso} name={id.country} large size={32} />
                  <Star on={cl?.relation === "direct competitor"} />
                  <H2>{d.name}</H2>
                  <Chip tone="hot">{cl?.relation}</Chip>
                  <Chip tone="cool">{cl?.proximity}/4 · {cl?.proximity_band}</Chip>
                  <Chip>{cl?.market}</Chip>
                </div>
                <div style={{ marginTop: 14 }}>
                  {([
                    ["Website", <Site url={id.url as string} />],
                    ["Headquarters", [id.hq_city, id.hq_state, id.country].filter(Boolean).join(", ")],
                    ["In their words", id.description_by_company],
                    ["In the press", id.described_by_press_as],
                    ["As of", d.as_of],
                  ] as [string, any][]).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 16, padding: "6px 0", fontSize: 13.5, lineHeight: 1.5 }}>
                      <div className="of-src" style={{ minWidth: 118, flexShrink: 0 }}>{k}</div><div>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}><Cite ids={id.source_ids} /></div>
              </Card>
            </Section>

            <Section kicker={`${d.name} — how close they are`}>
              <Grid cols={4} style={{ marginBottom: 18 }}>
                {Object.entries(axes).map(([k, v]) => (
                  <Cell key={k}>
                    <Stat value={v ? "yes" : "no"} label={k} sub={v ? "axis met" : "axis not met"} />
                  </Cell>
                ))}
              </Grid>
              {Object.entries(ev).map(([k, v]) => (
                <div key={k} style={{ padding: "9px 0", borderBottom: "1px solid var(--line-soft)" }}>
                  <div className="of-src">{k.replace(/_/g, " ")}</div>
                  <div style={{ marginTop: 4, fontSize: 13.5 }}>&ldquo;{v}&rdquo;</div>
                </div>
              ))}
              {re && (
                <Note style={{ marginTop: 16 }}>
                  Reclassified {re.date as string}: {(re.from as Rec).relation} at {(re.from as Rec).proximity}/4
                  → {(re.to as Rec).relation} at {(re.to as Rec).proximity}/4. {re.reason as string}
                </Note>
              )}
            </Section>

            {rounds.length > 0 && (
              <Section kicker={`${d.name} — funding`}>
                <Grid cols={2} style={{ marginBottom: 18 }}>
                  <Cell><Stat value={fu.total_disclosed as string} label="total disclosed" sub="press characterisation" /></Cell>
                  <Cell><Stat value={rounds.length} label="rounds on record" /></Cell>
                </Grid>
                <Table rows={rounds} cols={[
                  { key: "stage", label: "Stage", render: (r) => <strong>{r.stage}</strong> },
                  { key: "amount", label: "Amount" },
                  { key: "announced", label: "Announced", render: (r) => <span className="of-num">{r.announced}</span> },
                  { key: "lead_investor", label: "Lead" },
                  { key: "other_investors", label: "Others", render: (r) => <Chips items={r.other_investors} /> },
                  { key: "stated_use", label: "Stated use", render: (r) => <span className="of-note">{r.stated_use}</span> },
                ]} />
                {rounds.map((r) => r.date_basis ? (
                  <Note key={r.stage as string} style={{ marginTop: 12 }}>{r.date_basis as string}</Note>) : null)}
              </Section>
            )}

            {(d.contracts as Rec[])?.length > 0 && (
              <Section kicker={`${d.name} — contracts on record`}>
                <Table rows={d.contracts as Rec[]} cols={[
                  { key: "value", label: "Value", render: (r) => <strong>{r.value}</strong> },
                  { key: "customer", label: "Customer", render: (r) => <>{r.customer}{r.end_user ? <Sub>end user {r.end_user as string}</Sub> : null}</> },
                  { key: "instrument", label: "Instrument", render: (r) => <span className="of-note">{r.instrument}</span> },
                  { key: "scope", label: "Scope", render: (r) => <span className="of-note">{r.scope}</span> },
                  { key: "announced", label: "Announced", render: (r) => <span className="of-num">{r.announced}</span> },
                ]} />
              </Section>
            )}

            {(d.platforms as Rec[])?.length > 0 && (
              <Section kicker={`${d.name} — platforms`}>
                {(d.platforms as Rec[]).map((pl) => (
                  <Card key={pl.name as string} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                      <H3>{pl.name}</H3><Chip tone="cool">{pl.status}</Chip>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {([
                        ["Length", pl.length], ["Weight", pl.weight], ["Top speed", pl.top_speed],
                        ["Endurance", pl.endurance], ["Payload", pl.payload], ["Unit price", pl.unit_price],
                        ["Propulsion", pl.propulsion], ["Power", pl.power], ["Deployment", pl.deployment],
                        ["Role, company", pl.role_by_company], ["Role, press", pl.role_by_press],
                        ["Share of business", pl.share_of_business],
                      ] as [string, any][]).filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", gap: 16, padding: "5px 0", fontSize: 13.5 }}>
                          <div className="of-src" style={{ minWidth: 128, flexShrink: 0 }}>{k}</div><div>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12 }}><Cite ids={pl.source_ids} /></div>
                  </Card>
                ))}
              </Section>
            )}

            {(d.articles as Rec[])?.length > 0 && (
              <Section kicker={`${d.name} — articles and links`}>
                {(d.articles as Rec[]).map((a) => (
                  <Card key={a.url as string} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span className="of-num of-src">{(a.published as string) ?? "undated"}</span>
                      <Chip tone="solid">{a.type}</Chip>
                      <strong style={{ fontSize: 14 }}>{a.title}</strong>
                    </div>
                    <div className="of-src" style={{ marginTop: 6 }}>
                      {a.publisher}{a.author ? ` · ${a.author}` : ""} · retrieved {a.retrieved as string}
                    </div>
                    <div style={{ marginTop: 8 }}><Site url={a.url as string} /></div>
                    {(a.key_points as string[])?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        {(a.key_points as string[]).map((k) => (
                          <div key={k} className="of-note" style={{ padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>{k}</div>
                        ))}
                      </div>
                    )}
                    {a.caution ? <Note style={{ marginTop: 12 }}>{a.caution as string}</Note> : null}
                  </Card>
                ))}
              </Section>
            )}

            {(d.quotes as Rec[])?.length > 0 && (
              <Section kicker={`${d.name} — quoted`}>
                {(d.quotes as Rec[]).map((q) => (
                  <Card key={(q.text as string).slice(0, 40)} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 15, lineHeight: 1.55 }}>&ldquo;{q.text}&rdquo;</div>
                    <div className="of-src" style={{ marginTop: 8 }}>
                      {[q.person, q.role, q.date].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ marginTop: 10 }}><Cite ids={q.source_ids} /></div>
                  </Card>
                ))}
              </Section>
            )}

            {(d.conflicts as Rec[])?.length > 0 && (
              <Section kicker={`${d.name} — sources that disagree`}>
                {(d.conflicts as Rec[]).map((c) => (
                  <Card key={c.field as string} style={{ marginBottom: 12 }}>
                    <div className="of-kicker" style={{ marginBottom: 10 }}>{c.field}</div>
                    {(c.values as Rec[]).map((v) => (
                      <div key={v.source_id as string} style={{ padding: "7px 0", borderBottom: "1px solid var(--line-soft)" }}>
                        <div style={{ fontSize: 13.5 }}>{v.value}</div>
                        <div style={{ marginTop: 4 }}>
                          <Site url={source(v.source_id as string)?.url} label={source(v.source_id as string)?.publisher} />
                          <span className="of-src"> · {(v.date as string) ?? "undated"}</span>
                        </div>
                      </div>
                    ))}
                    <Note style={{ marginTop: 12 }}>{c.resolution as string}</Note>
                  </Card>
                ))}
              </Section>
            )}

            <Section kicker={`${d.name} — what we do not know`}>
              {(d.gaps as string[]).map((g) => <Gap key={g}>{g}</Gap>)}
            </Section>

            <Section kicker={`${d.name} — every source`}>
              <Table rows={(d.source_ids as string[]).map((sid) => source(sid) ?? { id: sid })} cols={[
                { key: "name", label: "Source", render: (r) => <strong>{r.name ?? r.id}</strong> },
                { key: "publisher", label: "Publisher" },
                { key: "type", label: "Type", render: (r) => r.type ? <Chip>{r.type}</Chip> : null },
                { key: "published", label: "Published", render: (r) => <span className="of-num">{r.published ?? "—"}</span> },
                { key: "retrieved", label: "Retrieved", render: (r) => <span className="of-num">{r.retrieved}</span> },
                { key: "url", label: "Link", render: (r) => <Site url={r.url as string} /> },
              ]} />
            </Section>
          </div>
        );
      })}
    </>
  );
}
