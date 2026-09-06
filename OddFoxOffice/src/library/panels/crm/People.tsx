import { Section, Grid, Cell, Stat, Note, H1, Card, Chip, Site, Logo } from "../../../ui";
import type { Rec } from "../../../data";
import type { ContactRecord } from "../../../lib/crmStore";
import { contactsFile, useAccounts, useContacts } from "./shared";
import { ServerState } from "./ServerState";

export function CrmPeople() {
  const { rows: people, live, error } = useContacts();
  const { rows: accounts } = useAccounts();

  // Most contact rows carry a company name but no account_id, so fall back to the name.
  const byName = new Map(accounts.map((r) => [r.company, r]));
  const accountFor = (x: ContactRecord) =>
    accounts.find((r) => r.id === x.account_id) ?? byName.get(x.company ?? "");

  const withProfile = people.filter((x) => x.linkedin_url).length;
  const con = contactsFile;

  return (
    <>
      <H1>People</H1>
      <p className="of-lede">
        Named individuals at the target accounts. Profile links were matched from public search
        results on name plus employer plus published title — nothing was read from behind a login.
      </p>

      <ServerState live={live} error={error} />

      <Section kicker="Points of contact">
        <Grid cols={4} style={{ marginBottom: 20 }}>
          <Cell><Stat value={people.length} label="people on record" sub={con.target as string} /></Cell>
          <Cell><Stat value={withProfile} label="with a LinkedIn profile" sub={`of ${people.length}`} /></Cell>
          <Cell><Stat value={people.filter((x) => x.priority === 1).length} label="priority 1 roles"
                      sub="DPA and fleet" /></Cell>
          <Cell><Stat value={people.filter((x) => x.connection_degree === 1).length}
                      label="first-degree connections" sub="warm, message directly" /></Cell>
        </Grid>

        {people.length > 0 ? (
          <div className="of-matrix-wrap">
            <table className="of-matrix of-crm">
              <thead><tr>
                <th className="co">Name</th><th>Title</th><th>Company</th>
                <th>Buying role</th><th>P</th><th>Warm</th><th>LinkedIn</th><th>Source</th>
              </tr></thead>
              <tbody>
                {people.map((x) => {
                  const acct = accountFor(x);
                  return (
                    <tr key={x.id}>
                      <td className="co">
                        {x.linkedin_url
                          ? <a className="co-row" href={x.linkedin_url} target="_blank"
                               rel="noopener noreferrer" title={x.linkedin_url}>
                              <span className="co-name">{x.full_name}</span>
                            </a>
                          : <span className="co-row"><span className="co-name">{x.full_name}</span></span>}
                      </td>
                      <td className="cell"><span className="of-note">{x.title}</span></td>
                      <td className="cell">
                        <span className="of-cell-co">
                          <Logo url={acct?.url ?? null} name={x.company ?? "?"} size={16} />
                          {x.company ?? x.account_id ?? "—"}
                        </span>
                      </td>
                      <td className="cell"><Chip>{x.buying_role}</Chip></td>
                      <td className="val">{x.priority ?? "—"}</td>
                      <td className="cell">{x.connection_degree === 1
                        ? <Chip tone="calm">1st</Chip> : <span className="of-dot-off" />}</td>
                      <td className="cell">{x.linkedin_url
                        ? <Site url={x.linkedin_url} label="profile" />
                        : <span className="of-dot-off" title="no public profile found" />}</td>
                      <td className="cell">{x.source_url ? <Site url={x.source_url} /> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Note>No people on record yet. The role map below is what the research will fill.</Note>
        )}

        <div style={{ marginTop: 24 }}>
          <div className="of-kicker" style={{ marginBottom: 12 }}>Which titles to go for</div>
          {(((con.role_map as Rec)?.roles as Rec[]) ?? []).map((r) => (
            <Card key={r.id as string} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <Chip tone={r.priority === 1 ? "hot" : r.priority === 2 ? "warm" : ""}>
                  priority {r.priority as number}
                </Chip>
                <strong style={{ fontSize: 13.5 }}>{(r.titles as string[]).join(" · ")}</strong>
              </div>
              <div className="of-note" style={{ marginTop: 8 }}>{r.why as string}</div>
              <div className="of-src" style={{ marginTop: 6 }}>maps to {r.buying_role as string}</div>
            </Card>
          ))}
          <Note>{(con.role_map as Rec)?.ranking as string}</Note>
        </div>

        <div style={{ marginTop: 22 }}>
          <div className="of-kicker" style={{ marginBottom: 10 }}>Collection rules</div>
          {(((con.collection_rules as string[]) ?? (con.policy as string[])) ?? []).map((x) => (
            <div key={x} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 13 }}>{x}</div>
          ))}
        </div>
      </Section>
    </>
  );
}
