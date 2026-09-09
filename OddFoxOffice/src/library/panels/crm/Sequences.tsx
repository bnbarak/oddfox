import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Section, Note, H1, H2, Card, Chip, Gap } from "../../../ui";
import type { Rec } from "../../../data";
import { EmailBody } from "./EmailBody";
import { sequencesFile } from "./shared";

/** The cadence as an actual timeline rather than three equal boxes.

    Nodes sit at their real day offset — day 0, 4, 11 — so the widening gap
    between rounds is visible, which is the whole point of a cadence and the
    thing a stacked list of cards hides. Days are read out of the file's
    cadence block, so changing it there moves the chart. */
function Cadence({ rounds, cadence }: { rounds: Rec[]; cadence: Rec }) {
  const day = (n: number) => {
    const raw = String(cadence[`round_${n}`] ?? "");
    const m = raw.match(/\d+/);
    return m ? Number(m[0]) : (n - 1) * 4;
  };
  const days = rounds.map((r) => day(r.round as number));
  const span = Math.max(...days, 1);

  return (
    <div className="of-cad">
      <div className="of-cad__line" />
      {rounds.map((r, i) => (
        <div key={r.round as number} className="of-cad__node"
             style={{ left: `${(days[i]! / span) * 100}%` }}>
          <span className="of-cad__dot" />
          <span className="of-cad__day">day {days[i]}</span>
          <span className="of-cad__r">Round {r.round as number}</span>
          <span className="of-cad__sub" title={r.subject as string}>{r.subject as string}</span>
        </div>
      ))}
      {cadence.then ? (
        <div className="of-cad__end">
          <span className="of-cad__dot is-end" />
          <span className="of-cad__day">after</span>
          <span className="of-cad__r">{cadence.then as string}</span>
        </div>
      ) : null}
    </div>
  );
}

export function CrmSequences() {
  const seq = sequencesFile;
  /* ?tier= so a message can link to the script it is following. Read once as
     the initial value rather than watched: the sidebar is the owner of this
     after the page opens, and syncing both ways would fight the click. */
  const [params] = useSearchParams();
  const asked = Number(params.get("tier"));
  const [openSeq, setOpenSeq] = useState<number>(Number.isFinite(asked) && asked ? asked : 1);
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <>
      <H1>Sequences</H1>

      <Section kicker="Sequences">
        {/* A sidebar rather than a row of buttons: six tier names are long
            enough that a horizontal strip wraps onto two lines and stops
            reading as a list of choices. */}
        <div className="of-seq">
          <nav className="of-seq__side" aria-label="Tiers">
            {(seq.sequences as Rec[]).map((s) => (
              <button key={s.tier as number}
                      className={`of-seq__b${openSeq === s.tier ? " is-on" : ""}`}
                      onClick={() => setOpenSeq(s.tier as number)}>
                {s.tier_name as string}
              </button>
            ))}
          </nav>
          <div className="of-seq__body">
        {(seq.sequences as Rec[]).filter((s) => s.tier === openSeq).map((s) => (
          <div key={s.tier as number}>
            <Note style={{ marginBottom: 16 }}>{s.premise as string}</Note>
            {s.warning ? (
              <div className="of-gap" style={{ marginBottom: 16 }}>{s.warning as string}</div>
            ) : null}
            <Cadence rounds={s.rounds as Rec[]} cadence={seq.cadence as Rec} />
            {(s.rounds as Rec[]).map((rd) => (
              <Card key={rd.round as number} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Chip tone="solid">Round {rd.round as number}</Chip>
                  <H2>{rd.subject as string}</H2>
                </div>
                <EmailBody text={rd.body as string} />
                <button className="of-facet__b" onClick={() => {
                  navigator.clipboard?.writeText(`Subject: ${rd.subject}\n\n${rd.body}`);
                  setCopied(`Round ${rd.round} copied`); setTimeout(() => setCopied(null), 2500);
                }}>Copy</button>
              </Card>
            ))}
          </div>
        ))}
          </div>
        </div>
        {copied && <span className="of-note">{copied}</span>}
        <Note style={{ marginTop: 12 }}>{seq.compliance_note as string}</Note>
      </Section>

      <Section kicker="What blocks this today">
        {((seq.gaps as string[]) ?? []).map((x) => <Gap key={x}>{x}</Gap>)}
      </Section>
    </>
  );
}
