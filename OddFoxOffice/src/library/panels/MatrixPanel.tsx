import { DB, tally, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Table, Note, H1, Chip, Chips, Bars, Pie, Flag,
         Star, Site, Matrix, type MatrixRow, type MatrixCol } from "../../ui";

const MTONE: Record<string, any> = { military: "hot", commercial: "calm", both: "cool" };
const MCOLOR: Record<string, string> = { military: "var(--hot)", commercial: "var(--calm)", both: "var(--cool)" };

export type MatrixFilters = Record<string, string[]>;

const REL_ORDER: Record<string, number> = {
  "direct competitor": 0, "adjacent platform builder": 1, supplier: 2, adjacent: 3, reference: 4,
};

const has = (r: Rec, id: string) => ((r.builds as string[] | undefined) ?? []).includes(id);

/** OR within a facet, AND across facets. Capabilities AND together: picking two
    columns asks for companies that build both. */
function apply(rows: Rec[], f: MatrixFilters, skip?: string): Rec[] {
  const on = (k: string) => (skip === k ? [] : (f[k] ?? []));
  return rows.filter((r) =>
    on("builds").every((b) => has(r, b)) &&
    (on("market").length === 0 || on("market").includes(r.market as string)) &&
    (on("relation").length === 0 || on("relation").includes(r.relation as string)) &&
    (on("tech").length === 0 || on("tech").includes(r.tech_status as string)) &&
    (on("compclass").length === 0 || on("compclass").includes(r.competitor_class as string)) &&
    (on("funding").length === 0 || Boolean(r.funding ?? r.public_listing)) &&
    (on("leaders").length === 0 || Boolean((r.leadership as Rec[])?.length)) &&
    (on("sells").length === 0 || on("sells").some((v) => ((r.categories as string[]) ?? []).includes(v))) &&

    (on("band").length === 0 || on("band").includes(r.proximity_band as string)) &&
    (on("country").length === 0 || on("country").includes(r.country as string)));
}

export type MatrixSort = { col: number; dir: "asc" | "desc" } | null;

export function MatrixPanel({ matrixF, setMatrixF, matrixAllCols, setMatrixAllCols, matrixSort, setMatrixSort }: {
  matrixF: MatrixFilters; setMatrixF: (v: MatrixFilters) => void;
  matrixAllCols: boolean; setMatrixAllCols: (v: boolean) => void;
  matrixSort: MatrixSort; setMatrixSort: (v: MatrixSort) => void;
}) {
  const d = DB.marketPlayers as Rec;
  const bt = d.builds_taxonomy as Rec[];
  const all = d.records as Rec[];

  const rows = apply(all, matrixF);
  const usv = rows.filter((r) => has(r, "usv"));
  const sev = rows.filter((r) => has(r, "crewed-vessel"));
  const usvCom = usv.filter((r) => r.market === "commercial");

  const toggle = (facet: string, option: string) => {
    const cur = matrixF[facet] ?? [];
    setMatrixF({ ...matrixF, [facet]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option] });
  };
  const reset = () => { setMatrixF({}); setMatrixAllCols(false); setMatrixSort(null); };
  const activeCount = Object.values(matrixF).reduce((a2, b2) => a2 + b2.length, 0);

  /* Every filterable thing is a column, so the header is the only control surface.
     Counts on each option reflect the other columns' filters. */
  const countIn = (facet: string, pick: (r: Rec) => boolean) => apply(all, matrixF, facet).filter(pick).length;
  const opts = (facet: string, vals: string[], pick: (v: string) => (r: Rec) => boolean) =>
    vals.map((v) => ({ id: v, label: v, n: countIn(facet, pick(v)) }));

  const anyFilter = Object.values(matrixF).some((x) => x.length > 0);
  const colCount = (id: string) => rows.filter((r) => has(r, id)).length;
  const shownBt = (anyFilter && !matrixAllCols)
    ? bt.filter((c) => colCount(c.id as string) > 0 || (matrixF.builds ?? []).includes(c.id as string))
    : bt;
  const hiddenCols = bt.length - shownBt.length;

  const countries = [...new Set(all.map((r) => r.country as string))].sort();

  /* Declarative column spec: label, how to read the value, how to sort, what to filter by. */
  type Spec = {
    label: string; title?: string; facet?: string;
    options?: { id: string; label: string; n: number }[];
    cell: (r: Rec) => any;
    sortVal: (r: Rec) => string | number;
  };

  const capSpecs: Spec[] = shownBt.map((c) => ({
    label: (c.short ?? c.name) as string,
    title: c.name as string,
    facet: "builds",
    options: [{ id: c.id as string, label: `builds ${c.name}`, n: countIn("builds", (r) => has(r, c.id as string)) }],
    cell: (r) => {
      const on = has(r, c.id as string);
      return { on, tone: on ? MTONE[r.market as string] : "", title: c.name as string };
    },
    sortVal: (r) => (has(r, c.id as string) ? 0 : 1),
  }));

  const metaSpecs: Spec[] = [
    { label: "Tech", facet: "tech",
      options: opts("tech", ["pure tech", "tech-led", "service-led", "service only"], (v) => (r) => r.tech_status === v),
      cell: (r) => ({ text: r.tech_share != null ? `${r.tech_share}%` : "" }),
      sortVal: (r) => -(r.tech_share as number ?? -1) },
    { label: "Competitor", facet: "compclass",
      options: opts("compclass", ["autonomous", "traditional"], (v) => (r) => r.competitor_class === v),
      cell: (r) => ({ text: (r.competitor_class as string) ?? "" }),
      sortVal: (r) => (r.competitor_class as string) ?? "zz" },
    { label: "Sells", facet: "sells",
      options: (d.categories as Rec[]).map((c) => ({ id: c.id as string, label: c.name as string,
        n: countIn("sells", (r) => ((r.categories as string[]) ?? []).includes(c.id as string)) })),
      cell: (r) => ({ text: ((r.categories as string[]) ?? []).length ? String(((r.categories as string[]) ?? []).length) : "" }),
      sortVal: (r) => -(((r.categories as string[]) ?? []).length) },
    { label: "Market", facet: "market",
      options: opts("market", ["commercial", "military", "both"], (v) => (r) => r.market === v),
      cell: (r) => ({ text: (r.market as string) ?? "" }),
      sortVal: (r) => (r.market as string) ?? "zz" },
    { label: "Relation", facet: "relation",
      options: opts("relation", Object.keys(REL_ORDER), (v) => (r) => r.relation === v),
      cell: (r) => ({ text: (r.relation as string) ?? "" }),
      sortVal: (r) => REL_ORDER[r.relation as string] ?? 9 },
    { label: "Prox", title: "Proximity band", facet: "band",
      options: opts("band", [...new Set(all.map((r) => r.proximity_band as string))].filter(Boolean),
        (v) => (r) => r.proximity_band === v),
      cell: (r) => ({ text: r.proximity != null ? `${r.proximity}/4` : "", num: true }),
      sortVal: (r) => -(r.proximity as number ?? -1) },
    { label: "Country", facet: "country",
      options: countries.map((v) => ({ id: v, label: v, n: countIn("country", (r) => r.country === v) })),
      cell: (r) => ({ text: (r.country as string) ?? "" }),
      sortVal: (r) => (r.country as string) ?? "zz" },
    { label: "Founded",
      cell: (r) => ({ text: r.founded ? String(r.founded) : "", num: true }),
      sortVal: (r) => -(r.founded as number ?? 0) },
    { label: "Funding", facet: "funding",
      options: [{ id: "has", label: "on record", n: countIn("funding", (r) => Boolean(r.funding ?? r.public_listing)) }],
      cell: (r) => ({ text: (r.funding as string) ?? (r.public_listing as string) ?? "" }),
      sortVal: (r) => (r.funding ?? r.public_listing ? 0 : 1) },
    { label: "Leadership", facet: "leaders",
      options: [{ id: "has", label: "named", n: countIn("leaders", (r) => Boolean((r.leadership as Rec[])?.length)) }],
      cell: (r) => ({ text: ((r.leadership as Rec[]) ?? []).map((l) => l.person).join(", ") }),
      sortVal: (r) => (((r.leadership as Rec[]) ?? []).length ? 0 : 1) },
  ];

  const specs = [...capSpecs, ...metaSpecs];

  const cols: MatrixCol[] = specs.map((sp) => ({
    label: sp.label, title: sp.title,
    options: sp.options,
    selected: sp.facet ? (matrixF[sp.facet] ?? []).filter((v) => sp.options?.some((o) => o.id === v)) : [],
    sortable: true,
  }));

  const onSort = (col: number, dir: "asc" | "desc") => setMatrixSort({ col, dir });
  const onFilter = (col: number, optionId: string) => {
    const sp = specs[col]; if (!sp?.facet) return;
    toggle(sp.facet, optionId);
  };
  const onClearCol = (col: number) => {
    const sp = specs[col]; if (!sp?.facet) return;
    const keep = (matrixF[sp.facet] ?? []).filter((v) => !sp.options?.some((o) => o.id === v));
    setMatrixF({ ...matrixF, [sp.facet]: keep });
  };

  const sorted = [...rows].sort((a2, b2) => {
    if (matrixSort) {
      if (matrixSort.col === -1) {
        const r = (a2.name as string).localeCompare(b2.name as string);
        return matrixSort.dir === "asc" ? r : -r;
      }
      const sp = specs[matrixSort.col];
      if (sp) {
        const x = sp.sortVal(a2), y = sp.sortVal(b2);
        const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        if (r !== 0) return matrixSort.dir === "asc" ? r : -r;
      }
    }
    return (REL_ORDER[a2.relation as string] - REL_ORDER[b2.relation as string]) ||
           (a2.name as string).localeCompare(b2.name as string);
  });

  const mrows: MatrixRow[] = sorted.map((r) => ({
    label: r.name as string,
    sub: `${r.hq_city ? `${r.hq_city}, ` : ""}${r.country}`,
    star: r.competitor_class === "autonomous",
    url: (r.url as string) ?? null,
    cells: specs.map((sp) => sp.cell(r)),
  }));

  const empty = rows.length === 0;

  return (
    <>
      <H1>What they build</H1>
      <p className="of-lede">{(d.market_axis as Rec).note}</p>

      <Section kicker="Comparison matrix">
        <div className="of-facetbar">
          <div>
            <strong className="of-num">{rows.length}</strong>
            <span className="of-note"> of {all.length} companies</span>
            {activeCount > 0 && <span className="of-note"> · {activeCount} filter{activeCount === 1 ? "" : "s"} on</span>}
            {hiddenCols > 0 && <span className="of-note"> · {hiddenCols} empty columns hidden</span>}
            <span className="of-note"> · hover any column header to sort or filter</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(hiddenCols > 0 || matrixAllCols) && (
              <button className="of-facet__b" onClick={() => setMatrixAllCols(!matrixAllCols)}>
                {matrixAllCols ? "Hide empty columns" : "Show all columns"}
              </button>
            )}
            <button className="of-reset" onClick={reset} disabled={activeCount === 0 && !matrixSort}>Reset</button>
          </div>
        </div>
        <Matrix rows={mrows} cols={cols} corner="Company"
                sort={matrixSort} onSort={onSort} onFilter={onFilter} onClear={onClearCol} />
        <div className="of-maplegend" style={{ marginTop: 16 }}>
          <span className="k"><span className="of-dot calm" />commercial</span>
          <span className="k"><span className="of-dot hot" />military</span>
          <span className="k"><span className="of-dot cool" />both</span>
          <span className="k"><span className="of-dot-off" />does not build this</span>
        </div>
        <Note style={{ marginTop: 16 }}>
          Click a capability column header to filter to companies that build it; several columns together
          ask for companies that build all of them. Other facets are OR within themselves and AND across.
          Everything below this matrix reflects the current selection.
          Rows ordered by relation: direct competitors first, then platform builders, then suppliers.
        </Note>
      </Section>

      {empty ? (
        <Section kicker="No matches">
          <Note>No company in the file matches every filter. Reset, or drop one of the capability columns.</Note>
        </Section>
      ) : (
        <>
          <Section kicker="Escort platforms by market">
            <Grid cols={4}>
              <Cell><Stat value={usv.length} label="build uncrewed surface vessels"
                          sub={`${usv.filter((r) => r.market === "military").length} military, ${usv.filter((r) => r.market === "both").length} dual-market`} /></Cell>
              <Cell><Stat value={usvCom.length} label="build USVs for commercial customers only" sub={`of ${usv.length} USV builders`} /></Cell>
              <Cell><Stat value={sev.length} label="operate crewed escort vessels"
                          sub={`${sev.filter((r) => r.market === "commercial").length} of them commercial`} /></Cell>
              <Cell><Stat value={sev.filter((r) => has(r, "usv")).length} label="do both crewed escort and USVs" /></Cell>
            </Grid>
            <Grid cols={2} style={{ marginTop: 26 }}>
              <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>Selected companies by market</div>
                <Pie centreLabel="COMPANIES" items={tally(rows, "market").map((x) => ({ ...x, tone: MCOLOR[x.label] }))} /></Cell>
              <Cell><div className="of-kicker" style={{ marginBottom: 14 }}>USV builders by market</div>
                {usv.length
                  ? <Pie centreLabel="BUILDERS" items={tally(usv, "market").map((x) => ({ ...x, tone: MCOLOR[x.label] }))} />
                  : <Note>No USV builders in the current selection.</Note>}</Cell>
            </Grid>
          </Section>

          <Section kicker="What gets built, by capability">
            <Bars rows={bt.map((c) => ({
              label: c.name as string,
              value: rows.filter((r) => has(r, c.id as string)).length,
            })).sort((a, b) => b.value - a.value)} />
          </Section>

          <Section kicker="Capability definitions">
            <Table rows={bt} cols={[
              { key: "name", label: "Builds", render: (r) => <strong>{r.name}</strong> },
              { key: "note", label: "Means", render: (r) => <span className="of-note">{r.note}</span> },
              { key: "n", label: "Companies", num: true, render: (r) =>
                  rows.filter((x) => has(x, r.id as string)).length },
            ]} />
          </Section>

          <Section kicker="Products named by each company">
            <Table rows={rows.filter((r) => (r.products as string[] | undefined)?.length)} cols={[
              { key: "name", label: "Company", render: (r) => <><Flag iso={r.country_iso} name={r.country} /> <Star on={r.competitor_class === "autonomous"} /><strong>{r.name}</strong></> },
              { key: "market", label: "Market", render: (r) => <Chip tone={MTONE[r.market as string] ?? ""}>{r.market ?? "—"}</Chip> },
              { key: "products", label: "Named products", render: (r) => <Chips items={r.products} /> },
              { key: "url", label: "Website", render: (r) => <Site url={r.url as string} /> },
            ]} />
            <Note style={{ marginTop: 16 }}>
              Products as the company names them. {(d.enrichment as Rec).companies_enriched} of {all.length} companies
              have been through the structured enrichment pass; the rest carry only what the original source stated.
            </Note>
          </Section>

          <Section kicker="Leadership on record">
            <Table rows={rows.filter((r) => (r.leadership as Rec[] | undefined)?.length)} cols={[
              { key: "name", label: "Company", render: (r) => <><Flag iso={r.country_iso} name={r.country} /> <Star on={r.competitor_class === "autonomous"} /><strong>{r.name}</strong></> },
              { key: "market", label: "Market", render: (r) => <Chip tone={MTONE[r.market as string] ?? ""}>{r.market ?? "—"}</Chip> },
              { key: "leadership", label: "Named", render: (r) => (
                  <>{(r.leadership as Rec[]).map((l) => (
                    <div key={l.person as string} style={{ padding: "3px 0" }}>
                      <strong>{l.person}</strong><span className="sub">{l.title}</span>
                    </div>))}</>) },
              { key: "url", label: "Website", render: (r) => <Site url={r.url as string} /> },
            ]} />
            <div style={{ marginTop: 16 }}>
              <div className="of-gap">{((d.enrichment as Rec).leadership_pass as Rec).note}</div>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
