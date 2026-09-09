import { useState } from "react";
import { DB, type Rec } from "../../data";
import { Section, Cite, ConfChip, H1, H2, Card, Chip, Gap, Flag, Note, Toggle, Split, Star } from "../../ui";

const relTone = (r: string) =>
  r === "direct competitor" ? "hot" : /platform builder/.test(r) ? "warm" : r === "supplier" ? "cool" : "";

export function Players({ playerCat, setPlayerCat }: { playerCat: string; setPlayerCat: (v: string) => void }) {
  const d = DB.marketPlayers as Rec;
  const all = d.records as Rec[];
  const catName: Record<string, string> = Object.fromEntries(
    (d.categories as Rec[]).map((c) => [c.id, c.name]));
  const [q, setQ] = useState("");

  /* Search reads the whole record, not just the name: people look for a
     company by what it builds or where it is as often as by what it is
     called. Category and search stack — search does not leave the category. */
  const needle = q.trim().toLowerCase();
  const hit = (r: Rec) => {
    if (!needle) return true;
    const hay = [r.name, r.country, r.relation, r.mission, r.what, r.note,
                 ...(r.products as string[] | undefined ?? []),
                 ...(r.categories as string[]).map((c) => catName[c] ?? c)]
      .filter(Boolean).join(" ").toLowerCase();
    return needle.split(/\s+/).every((w) => hay.includes(w));
  };
  const inCat = playerCat === "all" ? all : all.filter((r) => (r.categories as string[]).includes(playerCat));
  const rows = inCat.filter(hit);
  const isoOf: Record<string, string> = {};
  all.forEach((c) => { if (c.country_iso) isoOf[c.country as string] = c.country_iso as string; });

  return (
    <>
      <H1>Company profiles</H1>

      <Section kicker="What each company says it does">
        <Split side={<>
          <input className="of-search" type="search" value={q} placeholder="Search companies"
                 aria-label="Search companies" onChange={(e) => setQ(e.target.value)} />
          <Toggle vertical value={playerCat} onChange={setPlayerCat}
                  options={[{ id: "all", label: `All (${all.length})` },
                    ...(d.categories as Rec[]).map((c) => ({
                      id: c.id as string,
                      label: `${c.name} (${all.filter((r) => (r.categories as string[]).includes(c.id as string)).length})`,
                    }))]} />
        </>}>
          {needle && (
            <div className="of-src" style={{ marginBottom: 14 }}>
              {rows.length} of {inCat.length} match “{q.trim()}”
            </div>
          )}
          {playerCat !== "all" && (
            <Note style={{ marginBottom: 18 }}>
              {(d.categories as Rec[]).find((c) => c.id === playerCat)?.note ?? ""}
            </Note>
          )}
          {rows.map((r) => (
            <Card key={r.id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Flag iso={r.country_iso} name={r.country} large size={32} />
                <Star on={!!r.starred} title="A company that matters to us" />
                {r.url ? <a className="of-link" href={r.url} target="_blank" rel="noopener"><H2>{r.name}</H2></a> : <H2>{r.name}</H2>}
                <Chip tone={relTone(r.relation) as any}>{r.relation}</Chip>
                <ConfChip level={r.confidence} />
              </div>
              <div className="of-src" style={{ marginTop: 8 }}>
                {r.country} · {(r.categories as string[]).map((c) => catName[c] ?? c).join(", ")}
              </div>
              {r.mission && <p style={{ marginTop: 12, fontSize: "14.5px" }}>{r.mission}</p>}
              <p className="of-note" style={{ marginTop: 12 }}>{r.what}</p>
              {r.note && <div className="of-callout" style={{ marginTop: 14 }}>{r.note}</div>}
              <div style={{ marginTop: 12 }}>
                {(r.source_ids as string[] | undefined)?.length
                  ? <Cite ids={r.source_ids} />
                  : <Gap>No source recorded — unverified.</Gap>}
              </div>
            </Card>
          ))}
          {rows.length === 0 && <Note>Nothing matches “{q.trim()}” here.</Note>}
        </Split>
      </Section>

      <Section kicker="Gaps">
        {(d.gaps as string[]).map((g, i) => <div key={i} style={{ marginBottom: 14 }}><Gap>{g}</Gap></div>)}
      </Section>
    </>
  );
}
