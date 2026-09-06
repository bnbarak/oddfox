import { DB, type Rec } from "../../data";
import { Section, Grid, Cell, Stat, Note, H1, H2, Card, Chip, Gap } from "../../ui";

const TONE: Record<string, any> = { strong: "calm", weak: "warm", none: "hot" };

export function VC() {
  const v = DB.vcDiligence as unknown as Rec;
  const themes = v.questions as Rec[];
  const all = themes.flatMap((t) => t.items as Rec[]);
  const n = (s: string) => all.filter((x) => x.strength === s).length;
  const m = v.market_sizing as Rec;

  return (
    <>
      <H1>What a VC would ask</H1>
      <p className="of-lede">{v.description as string}</p>

      <Section kicker="How we would score">
        <Grid cols={4}>
          <Cell><Stat value={all.length} label="questions" /></Cell>
          <Cell><Stat value={n("strong")} label="we answer well" sub="sourced to incident level" /></Cell>
          <Cell><Stat value={n("weak")} label="we answer weakly" sub="answer exists, rests on assumptions" /></Cell>
          <Cell><Stat value={n("none")} label="we cannot answer" sub="half the room" /></Cell>
        </Grid>
      </Section>

      <Section kicker="The five that hurt">
        {(v.the_five_that_hurt as string[]).map((x, i) => (
          <div key={x} style={{ display: "flex", gap: 12, padding: "12px 0",
                                borderBottom: "1px solid var(--line-soft)", alignItems: "baseline" }}>
            <span className="of-num" style={{ color: "var(--hot)", fontSize: 18 }}>{i + 1}</span>
            <span style={{ fontSize: 14.5, lineHeight: 1.5 }}>{x}</span>
          </div>
        ))}
      </Section>

      <Section kicker="Market sizing">
        <Note style={{ marginBottom: 16 }}>{m.anchor as string}</Note>
        {(m.calc as Rec[]).map((c) => (
          <div key={c.metric as string} style={{ padding: "9px 0", borderBottom: "1px solid var(--line-soft)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <Chip tone={c.kind === "published" ? "calm" : c.kind === "derived" ? "cool" : "hot"}>{c.kind}</Chip>
              <strong style={{ fontSize: 13.5 }}>{c.metric}</strong>
              <span className="of-num">{String(c.value)}</span>
            </div>
            {c.warning ? <div className="of-gap" style={{ marginTop: 6 }}>{c.warning as string}</div> : null}
            {c.method ? <div className="of-src" style={{ marginTop: 4 }}>{c.method as string}</div> : null}
          </div>
        ))}
        <Note style={{ marginTop: 16 }}>{m.honest_caveat as string}</Note>
      </Section>

      {themes.map((t) => (
        <Section key={t.theme as string} kicker={t.theme as string}>
          {(t.items as Rec[]).map((q) => (
            <Card key={q.question as string} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <Chip tone={TONE[q.strength as string]}>{q.strength === "none" ? "no answer" : q.strength}</Chip>
                <H2>{q.question}</H2>
              </div>
              <div className="of-src" style={{ marginTop: 8 }}>{q.why_they_ask as string}</div>
              <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.55 }}>{q.our_answer_today as string}</div>
              {q.evidence ? <div className="of-src" style={{ marginTop: 8 }}>Evidence: {q.evidence as string}</div> : null}
              {q.what_kills_us ? <Note style={{ marginTop: 12 }}>{q.what_kills_us as string}</Note> : null}
            </Card>
          ))}
        </Section>
      ))}

      <Section kicker="What we would answer well">
        {(v.what_we_would_answer_well as string[]).map((x) => (
          <div key={x} style={{ padding: "9px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 13.5 }}>{x}</div>
        ))}
      </Section>

      <Section kicker="Cheapest things that would change the answer">
        {(v.cheapest_things_that_would_change_the_answer as string[]).map((x) => <Gap key={x}>{x}</Gap>)}
      </Section>
    </>
  );
}
