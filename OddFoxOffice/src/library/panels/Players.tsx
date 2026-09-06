import { DB, type Rec } from "../../data";
import { Section, Cite, ConfChip, H1, H2, Card, Chip, Gap, Flag, Note, Toggle } from "../../ui";

const relTone = (r: string) =>
  r === "direct competitor" ? "hot" : /platform builder/.test(r) ? "warm" : r === "supplier" ? "cool" : "";

export function Players({ playerCat, setPlayerCat }: { playerCat: string; setPlayerCat: (v: string) => void }) {
  const d = DB.marketPlayers as Rec;
  const all = d.records as Rec[];
  const catName: Record<string, string> = Object.fromEntries(
    (d.categories as Rec[]).map((c) => [c.id, c.name]));
  const rows = playerCat === "all" ? all : all.filter((r) => (r.categories as string[]).includes(playerCat));
  const isoOf: Record<string, string> = {};
  all.forEach((c) => { if (c.country_iso) isoOf[c.country as string] = c.country_iso as string; });

  return (
    <>
      <H1>Company profiles</H1>
      <p className="of-lede">{d.description}</p>

      <Section kicker="What each company says it does">
        <Toggle value={playerCat} onChange={setPlayerCat}
                options={[{ id: "all", label: `All (${all.length})` },
                  ...(d.categories as Rec[]).map((c) => ({
                    id: c.id as string,
                    label: `${c.name} (${all.filter((r) => (r.categories as string[]).includes(c.id as string)).length})`,
                  }))]} />
        {playerCat !== "all" && (
          <Note style={{ marginTop: 14 }}>
            {(d.categories as Rec[]).find((c) => c.id === playerCat)?.note ?? ""}
          </Note>
        )}
      </Section>

      <Section kicker="Profiles">
        {rows.map((r) => (
          <Card key={r.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Flag iso={r.country_iso} name={r.country} large size={32} />
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
      </Section>

      <Section kicker="Gaps">
        {(d.gaps as string[]).map((g, i) => <div key={i} style={{ marginBottom: 14 }}><Gap>{g}</Gap></div>)}
      </Section>
    </>
  );
}
