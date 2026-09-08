import { useState } from "react";
import { DB, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Table, Note, Cite, ConfChip, H1, H2, H3, Card, Chip,
         Chips, Gap, Flag, Toggle } from "../../ui";

/* Who insured which hull, who writes the cover, and who was refused.

   The panel leads with the refusals rather than the roster on purpose: the
   named slips are the easy half, and the interesting half is the five vessels
   where no insurer could be found at all. Status tone is carried consistently
   throughout — hot means nobody paid.                                        */

const STATUS: Record<string, { tone: "hot" | "warm" | "cool" | "calm" | ""; label: string }> = {
  named:       { tone: "calm", label: "slip on the record" },
  partial:     { tone: "cool", label: "some layers only" },
  disputed:    { tone: "warm", label: "claim contested" },
  declined:    { tone: "hot",  label: "insurer declined the voyage" },
  uninsured:   { tone: "hot",  label: "no cover found to exist" },
  "not-found": { tone: "warm", label: "insurer not identified" },
  "no-claim":  { tone: "",     label: "no loss, cover never tested" },
};

const OUTCOME_TONE: Record<string, "hot" | "warm" | "cool" | "calm" | ""> = {
  paid: "calm", disputed: "warm", refused: "hot",
  "declined-to-write": "hot", "no-exposure": "cool", unknown: "",
};

const usd = (n?: number | null) =>
  n == null ? "—" : n >= 1e9 ? `$${(n / 1e9).toFixed(n % 1e9 ? 2 : 0)}bn`
    : n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}m`
    : n === 0 ? "nothing" : `$${n.toLocaleString()}`;

export function Insurers() {
  const d = DB.insuranceMarket as Rec;
  const vessels = d.vessel_cover as Rec[];
  const unders = d.underwriters as Rec[];
  const [kind, setKind] = useState<string>("all");

  const counted = (s: string) => vessels.filter((v) => v.status === s).length;
  const namedOnes = vessels.filter((v) => (v.cover ?? []).length);
  const noInsurer = vessels.filter((v) => v.status === "not-found");

  const kinds = ["all", ...Array.from(new Set(unders.map((u) => u.kind as string)))];
  const shown = kind === "all" ? unders : unders.filter((u) => u.kind === kind);

  return (
    <>
      <H1>Who insures a ship</H1>
      <p className="of-lede">{d.description}</p>

      <Section kicker="What the record actually contains">
        <Grid cols={4}>
          <Cell><Stat value={namedOnes.length} label="hulls with a named insurer"
                      sub={`of ${vessels.length} attacked vessels chased`} /></Cell>
          <Cell><Stat value={noInsurer.length} label="hulls where no insurer could be found"
                      sub="searched and came back empty" /></Cell>
          <Cell><Stat value={counted("uninsured") + counted("declined")} label="hulls with no cover at all"
                      sub="declined, or none found to exist" /></Cell>
          <Cell><Stat value={(d.denials as Rec[]).length} label="documented refusals"
                      sub="declined, withdrawn, sanctioned or faked" /></Cell>
        </Grid>
        <Gap>
          Every named insurer here traces back to four publishers or one court. There is no third route into this
          data — which is why the vessels outside the London market are blank, and why those are exactly the hulls
          where cover is most likely to be absent or fictitious.
        </Gap>
      </Section>

      <Section kicker="The stack on a single hull">
        <Note>
          A loss is denied at the seam between two layers far more often than it is denied outright. Each of these is
          a different policy, a different insurer, and frequently a different broker.
        </Note>
        <div style={{ marginTop: 18 }}>
          {(d.layers as Rec[]).map((l) => (
            <Card key={l.id} style={{ marginBottom: 14 }}>
              <H2>{l.layer}</H2>
              <div style={{ marginTop: 14 }}>
                {[["Covers", l.covers], ["Excludes", l.excludes], ["Who writes it", l.who_writes_it],
                  ["Who pays", l.who_pays]].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} style={{ display: "flex", gap: 16, padding: "7px 0", fontSize: 13.5, lineHeight: 1.55 }}>
                    <div className="of-src" style={{ minWidth: 110, flexShrink: 0 }}>{k as string}</div>
                    <div>{v as string}</div>
                  </div>
                ))}
              </div>
              {l.note && <Note style={{ marginTop: 12 }}>{l.note}</Note>}
              {l.source_ids && <div style={{ marginTop: 12 }}><Cite ids={l.source_ids} /></div>}
            </Card>
          ))}
        </div>
      </Section>

      <Section kicker="Cover, hull by hull">
        {vessels.map((v) => {
          const st = STATUS[v.status] ?? { tone: "" as const, label: v.status };
          return (
            <Card key={v.id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <H2>{v.vessel}</H2>
                {v.imo && <span className="of-src of-num">IMO {v.imo}</span>}
                {v.date && <span className="of-src of-num">{v.date}</span>}
                <Chip tone={st.tone}>{st.label}</Chip>
                <ConfChip level={v.confidence} />
              </div>

              {v.insured_value_note && <Note style={{ marginTop: 12 }}>{v.insured_value_note}</Note>}

              {(v.cover ?? []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Table rows={v.cover as Rec[]} cols={[
                    { key: "layer", label: "Layer" },
                    { key: "insurer", label: "Insurer", render: (r) => <strong>{r.insurer}</strong> },
                    { key: "line_pct", label: "Line", num: true,
                      render: (r) => r.line_pct != null ? `${r.line_pct}%` : "—" },
                    { key: "role", label: "Role" },
                    { key: "outcome", label: "Outcome",
                      render: (r) => <Chip tone={OUTCOME_TONE[r.outcome] ?? ""}>{r.outcome}</Chip> },
                    { key: "note", label: "Note", render: (r) => <span className="of-note">{r.note ?? ""}</span> },
                  ]} />
                </div>
              )}

              {v.what_we_tried && (
                <Gap style={{ marginTop: 14 }}>
                  <strong>What we tried.</strong> {v.what_we_tried}
                </Gap>
              )}

              {v.conflict && (
                <Card style={{ marginTop: 14 }}>
                  <H3>Publishers disagree — {v.conflict.field}</H3>
                  <div style={{ marginTop: 10 }}>
                    {(v.conflict.readings as string[]).map((r, i) => (
                      <div key={i} className="of-note"
                           style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>{r}</div>
                    ))}
                  </div>
                  <Note style={{ marginTop: 10 }}>{v.conflict.action}</Note>
                </Card>
              )}

              {v.note && <Note style={{ marginTop: 12 }}>{v.note}</Note>}
              {v.source_ids && <div style={{ marginTop: 12 }}><Cite ids={v.source_ids} /></div>}
            </Card>
          );
        })}
      </Section>

      <Section kicker="Who got refused">
        <Note>
          The hardest data in the library. Underwriters rarely issue a formal refusal — they attach an affiliation
          warranty, decline the additional premium for a listed area, or cancel on 72 hours&rsquo; notice. All three
          are here.
        </Note>
        <div style={{ marginTop: 18 }}>
          {(d.denials as Rec[]).map((x) => (
            <Card key={x.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <H2>{x.who}</H2>
                {x.date && <span className="of-src of-num">{x.date}</span>}
                <Chip tone={x.kind === "uninsured-fleet" || x.kind === "fraudulent-cover" ? "hot" : "warm"}>
                  {(x.kind as string).replace(/-/g, " ")}
                </Chip>
                <ConfChip level={x.confidence} />
              </div>
              {x.by && <Note style={{ marginTop: 10 }}><strong>By:</strong> {x.by}</Note>}
              <Note style={{ marginTop: 10 }}>{x.what_happened}</Note>
              {x.grounds && <Note style={{ marginTop: 8 }}><strong>Grounds:</strong> {x.grounds}</Note>}
              {x.resolved && <Note style={{ marginTop: 8 }}><strong>Since:</strong> {x.resolved}</Note>}
              {x.note && <Gap style={{ marginTop: 12 }}>{x.note}</Gap>}
              {x.source_ids && <div style={{ marginTop: 12 }}><Cite ids={x.source_ids} /></div>}
            </Card>
          ))}
        </div>
      </Section>

      <Section kicker="The institutions">
        <Toggle options={kinds.map((k) => ({ id: k, label: k === "all" ? `All ${unders.length}` : k.replace(/-/g, " ") }))}
                value={kind} onChange={setKind} />
        <div style={{ marginTop: 18 }}>
          <Table rows={shown} cols={[
            { key: "name", label: "Name", render: (r) => (
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                  <Flag iso={r.domicile_iso} name={r.domicile} />
                  <strong>{r.name}</strong>
                </span>) },
            { key: "kind", label: "Kind", render: (r) => <Chip>{(r.kind as string).replace(/-/g, " ")}</Chip> },
            { key: "domicile", label: "Domicile" },
            { key: "founded", label: "Founded", num: true, render: (r) => r.founded ?? "—" },
            { key: "tonnage_gt_m", label: "Tonnage", num: true,
              render: (r) => r.tonnage_gt_m != null ? `${r.tonnage_gt_m}m GT` : "—" },
            { key: "seen_on", label: "Seen on", render: (r) => (r.seen_on ?? []).length
                ? <Chips items={r.seen_on as string[]} tone="cool" /> : <span className="of-note">—</span> },
          ]} />
        </div>
        <div style={{ marginTop: 20 }}>
          {shown.filter((u) => u.note).map((u) => (
            <div key={u.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13.5 }}>{u.name}</strong>
                <ConfChip level={u.confidence} />
              </div>
              <Note style={{ marginTop: 6 }}>{u.note}</Note>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="What was claimed, and what was paid">
        <Note>
          Estimates and confirmed payments are kept apart on purpose. No confirmed settled payment amount exists for
          any vessel in this dataset — insurers do not publish settlements.
        </Note>
        <div style={{ marginTop: 18 }}>
          <Table rows={d.claims as Rec[]} cols={[
            { key: "what", label: "What", render: (r) => <strong>{r.what}</strong> },
            { key: "vessel", label: "Vessel", render: (r) => r.vessel ?? "—" },
            { key: "date", label: "Date", render: (r) => r.date ?? "—" },
            { key: "amount_usd", label: "Amount", num: true,
              render: (r) => <strong>{r.label ?? usd(r.amount_usd)}</strong> },
            { key: "basis", label: "Basis",
              render: (r) => <Chip tone={r.basis === "paid" ? "calm" : r.basis === "claimed" ? "warm" : ""}>{r.basis}</Chip> },
            { key: "confidence", label: "Confidence", render: (r) => <ConfChip level={r.confidence} /> },
          ]} />
        </div>
        <div style={{ marginTop: 20 }}>
          {(d.claims as Rec[]).filter((c) => c.note).map((c) => (
            <div key={c.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13.5 }}>{c.what}</strong>
                <Cite ids={c.source_ids} />
              </div>
              <Note style={{ marginTop: 6 }}>{c.note}</Note>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="The judgments that decide who pays">
        {(d.case_law as Rec[]).map((c) => (
          <Card key={c.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <H2>{c.case}</H2>
              {c.citation && <span className="of-src of-num">{c.citation}</span>}
              <Chip tone={c.who_won === "insurer" ? "hot" : c.who_won === "assured" ? "calm" : "warm"}>
                {c.who_won === "pending" ? "undecided" : `${c.who_won} won`}
              </Chip>
            </div>
            {c.court && <Note style={{ marginTop: 10 }}>{c.court}{c.date ? ` · ${c.date}` : ""}</Note>}
            <Note style={{ marginTop: 10 }}><strong>Issue.</strong> {c.issue}</Note>
            <Note style={{ marginTop: 8 }}><strong>Held.</strong> {c.held}</Note>
            {c.amount_usd != null && (
              <div style={{ marginTop: 14 }}>
                <Stat value={usd(c.amount_usd)} label="at stake" />
              </div>
            )}
            <Gap style={{ marginTop: 12 }}>{c.why_it_matters}</Gap>
            {c.note && <Note style={{ marginTop: 10 }}>{c.note}</Note>}
            {c.source_ids?.length ? <div style={{ marginTop: 12 }}><Cite ids={c.source_ids} /></div> : null}
          </Card>
        ))}
      </Section>

      <Section kicker="Market size and shape">
        <Table rows={(d.market as Rec).figures as Rec[]} cols={[
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value", num: true,
            render: (r) => <strong>{typeof r.value === "number" ? r.value.toLocaleString() : r.value}</strong> },
          { key: "unit", label: "Unit" },
          { key: "period", label: "Period" },
          { key: "publisher", label: "Publisher" },
          { key: "confidence", label: "Confidence", render: (r) => <ConfChip level={r.confidence} /> },
        ]} />
        <div style={{ marginTop: 20 }}>
          {((d.market as Rec).figures as Rec[]).filter((f) => f.note).map((f) => (
            <div key={f.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13.5 }}>{f.metric}</strong>
                <Cite ids={f.source_ids} />
              </div>
              <Note style={{ marginTop: 6 }}>{f.note}</Note>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="Why this dataset has holes">
        {(d.why_it_is_opaque as string[]).map((w, i) => (
          <div key={i} style={{ marginBottom: 12 }}><Note>{w}</Note></div>
        ))}
      </Section>

      <Section kicker="Gaps">
        {(d.gaps as string[]).map((g, i) => (
          <div key={i} style={{ marginBottom: 12 }}><Gap>{g}</Gap></div>
        ))}
      </Section>

      <Section kicker="Open questions">
        {(d.open_questions as string[]).map((q, i) => (
          <div key={i} style={{ marginBottom: 14 }}><Gap>{q}</Gap></div>
        ))}
      </Section>
    </>
  );
}
