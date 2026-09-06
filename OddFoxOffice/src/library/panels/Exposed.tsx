import { DB, tally, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Table, Note, Cite, H1, Card, Chip, Flag, Sub,
         Pie, Bars, Gap, Site } from "../../ui";

const ROLE_LABEL: Record<string, string> = {
  "registered-owner": "Registered owner",
  "beneficial-owner": "Beneficial owner",
  "technical-manager": "Technical / ISM manager",
  "commercial-manager": "Commercial manager / operator",
};
const BUYS = new Set(["beneficial-owner", "technical-manager", "commercial-manager", "charterer"]);

export function Exposed() {
  const c = DB.customers as unknown as Rec;
  const rows = c.exposed as Rec[];
  const chains = c.vessel_chains as Rec[];
  const buyers = rows.filter((r) => BUYS.has(r.role as string));
  const named = chains.filter((v) => (v.parties as Rec[]).length > 0);
  const unnamed = chains.filter((v) => (v.parties as Rec[]).length === 0);

  return (
    <>
      <H1>Companies with a ship attacked</H1>
      <p className="of-lede">{c.exposed_note as string}</p>

      <Section kicker="Shape of the list">
        <Grid cols={4}>
          <Cell><Stat value={rows.length} label="companies named" sub={`across ${named.length} vessels`} /></Cell>
          <Cell><Stat value={buyers.length} label="in a role that buys security"
                      sub="per ownership-model.json" /></Cell>
          <Cell><Stat value={tally(rows, "country").length} label="countries" /></Cell>
          <Cell><Stat value={unnamed.length} label="attacked vessels with no company named"
                      sub="of the vessels researched" /></Cell>
        </Grid>
        <Grid cols={2} style={{ marginTop: 26 }}>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>By country</div>
            <Pie centreLabel="COMPANIES" items={tally(rows, "country")} /></Cell>
          <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>By role in the chain</div>
            <Bars rows={tally(rows, "role").map((x) => ({
              label: ROLE_LABEL[x.label] ?? x.label, value: x.value,
              tone: BUYS.has(x.label) ? "hot" : "cool",
            }))} />
            <Note style={{ marginTop: 12 }}>
              Red are roles that buy security. Registered owners do not; they are shells holding title.
            </Note></Cell>
        </Grid>
      </Section>

      <Section kicker="The list">
        <Table rows={rows} cols={[
          { key: "company", label: "Company", render: (r) => (
              <><Flag iso={r.country_iso} name={r.country} /> <strong style={{ marginLeft: 8 }}>{r.company}</strong></>) },
          { key: "role", label: "Role", render: (r) => (
              <Chip tone={BUYS.has(r.role as string) ? "hot" : ""}>{ROLE_LABEL[r.role as string] ?? r.role}</Chip>) },
          { key: "country", label: "Country" },
          { key: "vessels", label: "Vessel attacked", render: (r) => (
              <>{(r.vessels as Rec[]).map((v) => (
                <div key={v.vessel as string} style={{ padding: "3px 0" }}>
                  <strong>{v.vessel}</strong><Sub>{v.date as string}{v.imo ? ` · IMO ${v.imo}` : ""}</Sub>
                </div>))}</>) },
          { key: "src", label: "Sources", render: (r) => <Cite ids={r.source_ids} /> },
        ]} />
      </Section>

      <Section kicker="Chain per vessel">
        {chains.map((v) => (
          <Card key={v.vessel as string} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <span className="of-num of-src">{v.incident_date as string}</span>
              <strong style={{ fontSize: 14 }}>{v.vessel}</strong>
              {v.imo ? <span className="of-src">IMO {v.imo as string}</span> : null}
              {(v.parties as Rec[]).length === 0 && <Chip tone="warm">no company named</Chip>}
            </div>
            {(v.parties as Rec[]).map((pt) => (
              <div key={`${pt.company}-${pt.role}`} style={{ display: "flex", gap: 14, padding: "6px 0", fontSize: 13.5 }}>
                <div className="of-src" style={{ minWidth: 200, flexShrink: 0 }}>
                  {ROLE_LABEL[pt.role as string] ?? pt.role}
                </div>
                <div><strong>{pt.company}</strong> <span className="of-note">· {pt.country}</span></div>
              </div>
            ))}
            <Note style={{ marginTop: 10 }}>{v.note as string}</Note>
            <div style={{ marginTop: 10 }}><Cite ids={v.source_ids} /></div>
          </Card>
        ))}
      </Section>

      <Section kicker="Corporate contact points">
        <Note style={{ marginBottom: 16 }}>{c.contact_policy as string}</Note>
        <Table rows={c.contacts as Rec[]} cols={[
          { key: "company", label: "Company", render: (r) => <strong>{r.company}</strong> },
          { key: "url", label: "Website", render: (r) => <Site url={r.url as string} /> },
          { key: "head_office", label: "Head office", render: (r) => (
              <span className="of-note">{(r.head_office as string) ?? "—"}</span>) },
          { key: "phone", label: "Telephone", render: (r) => (
              <span className="of-num">{(r.phone as string) ?? "—"}</span>) },
          { key: "email", label: "Email", render: (r) => (
              r.email ? <a className="of-link of-site" href={`mailto:${r.email}`}>{r.email as string}</a> : "—") },
          { key: "fleet_size", label: "Fleet as stated", render: (r) => (
              <span className="of-note">{(r.fleet_size as string) ?? "—"}</span>) },
          { key: "note", label: "Note", render: (r) => <span className="of-note">{r.note}</span> },
          { key: "src", label: "Source", render: (r) => <Cite ids={r.source_ids} /> },
        ]} />
        <div style={{ marginTop: 18 }}>
          <div className="of-kicker" style={{ marginBottom: 10 }}>No official website verified</div>
          {(c.contacts_not_found as Rec[]).map((r) => (
            <div key={r.company as string} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <strong style={{ fontSize: 13.5 }}>{r.company}</strong>
              <div className="of-note" style={{ marginTop: 4 }}>{r.note as string}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="What we do not know">
        {(c.gaps as string[]).map((g) => <Gap key={g}>{g}</Gap>)}
      </Section>
    </>
  );
}
