import { useState } from "react";
import { Section, Grid, Cell, Stat, H1, Chip, Gap, Bars, Site, Logo, Star } from "../../../ui";
import type { AccountRecord } from "../../../lib/crmStore";
import { PIPE, TONE, today, link, accountsFile, contactsFile, useAccounts } from "./shared";
import { AccountDetail, AccountLink, useAccountParam } from "./Account";
import { ServerState } from "./ServerState";

export function CrmAccounts() {
  const { rows: seed, live, settled, error, patch } = useAccounts();
  const [tier, setTier] = useState<number | "all">("all");
  const [openId, setOpen] = useAccountParam();

  const rows = tier === "all" ? seed : seed.filter((r) => r.tier === tier);
  const byStatus = PIPE.map((s) => ({
    label: s, value: seed.filter((r) => r.status === s).length, tone: TONE[s] ?? "cool",
  })).filter((x) => x.value > 0);
  const touched = seed.filter((r) => r.status !== "not started").length;
  const linked = seed.filter((r) => link(r)).length;


  // One account asked for by the URL takes the whole page: it is a different
  // question from the pipeline, not a wider column of the same table.
  if (openId) return <AccountDetail id={openId} onBack={() => setOpen(null)} />;

  return (
    <>
      <H1>Accounts</H1>

      <ServerState live={live} settled={settled} error={error} />

      <Section kicker="Pipeline">
        <Grid cols={4}>
          <Cell><Stat value={seed.length} label="accounts" /></Cell>
          <Cell><Stat value={linked} label="with a link out" sub={`of ${seed.length}`} /></Cell>
          <Cell><Stat value={touched} label="accounts touched" /></Cell>
          <Cell><Stat value={seed.filter((r) => r.reachable).length} label="reachable without LinkedIn" /></Cell>
        </Grid>
        {byStatus.length > 1 && <div style={{ marginTop: 22 }}><Bars rows={byStatus} /></div>}
      </Section>

      <Section kicker="Accounts">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          <button className={`of-facet__b${tier === "all" ? " is-on" : ""}`} onClick={() => setTier("all")}>
            All<span className="of-facet__n">{seed.length}</span>
          </button>
          {[1, 2, 3, 4, 5, 6].map((t) => (
            <button key={t} className={`of-facet__b${tier === t ? " is-on" : ""}`} onClick={() => setTier(t)}>
              Tier {t}<span className="of-facet__n">{seed.filter((r) => r.tier === t).length}</span>
            </button>
          ))}
        </div>

        <div className="of-matrix-wrap">
          <table className="of-matrix of-crm">
            <thead>
              <tr>
                <th className="co">Account</th>
                <th>Tier</th><th>Roles</th><th>Contact</th>
                <th>Status</th><th>People</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const name = (
                  <>
                    <Logo url={r.url} name={r.company} />
                    <span className="co-name">{r.company}</span>
                    <Star on={r.starred} title="Starred account" />
                  </>
                );
                return (
                  <tr key={r.id}>
                    <td className="co">
                      <AccountLink id={r.id}>{name}</AccountLink>
                      {r.vessel_attacked ? <span className="co-sub">{r.vessel_attacked.join(", ")}</span>
                        : r.fleet ? <span className="co-sub">{r.fleet} vessels</span> : null}
                    </td>
                    <td className="cell">{r.tier}</td>
                    <td className="cell"><span className="of-note">{r.buying_roles.join(", ") || "—"}</span></td>
                    <td className="cell">
                      {r.email ? <a className="of-link of-site" href={`mailto:${r.email}`}>{r.email}</a>
                        : r.url ? <Site url={r.url} />
                        : r.linkedin_url ? <Site url={r.linkedin_url} label="LinkedIn page" />
                        : <Chip tone="warm">no link on record</Chip>}
                    </td>
                    <td className="cell">
                      <select className="of-sel" value={r.status} disabled={!live}
                              onChange={(e) => void patch(r.id,
                                { status: e.target.value as AccountRecord["status"], last_touch: today() })}>
                        {PIPE.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="val">{r.contacts.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section kicker="What blocks this today">
        {[...((accountsFile.gaps as string[]) ?? []),
          ...((contactsFile.gaps as string[]) ?? [])].map((x) => <Gap key={x}>{x}</Gap>)}
      </Section>
    </>
  );
}
