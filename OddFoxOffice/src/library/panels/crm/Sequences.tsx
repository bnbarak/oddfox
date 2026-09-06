import { useState } from "react";
import { Section, Note, H1, H2, Card, Chip, Gap } from "../../../ui";
import type { Rec } from "../../../data";
import { sequencesFile } from "./shared";

export function CrmSequences() {
  const seq = sequencesFile;
  const [openSeq, setOpenSeq] = useState<number>(1);
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <>
      <H1>Sequences</H1>
      <p className="of-lede">
        One three-round sequence per tier. The premise differs by tier because what the buyer is
        exposed to differs by tier.
      </p>

      <Section kicker="Sequences">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {(seq.sequences as Rec[]).map((s) => (
            <button key={s.tier as number}
                    className={`of-facet__b${openSeq === s.tier ? " is-on" : ""}`}
                    onClick={() => setOpenSeq(s.tier as number)}>
              Tier {s.tier as number} — {s.tier_name as string}
            </button>
          ))}
        </div>
        {(seq.sequences as Rec[]).filter((s) => s.tier === openSeq).map((s) => (
          <div key={s.tier as number}>
            <Note style={{ marginBottom: 16 }}>{s.premise as string}</Note>
            {s.warning ? (
              <div className="of-gap" style={{ marginBottom: 16 }}>{s.warning as string}</div>
            ) : null}
            {(s.rounds as Rec[]).map((rd) => (
              <Card key={rd.round as number} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Chip tone="solid">Round {rd.round as number}</Chip>
                  <H2>{rd.subject as string}</H2>
                </div>
                <pre className="of-mail">{rd.body as string}</pre>
                <button className="of-facet__b" onClick={() => {
                  navigator.clipboard?.writeText(`Subject: ${rd.subject}\n\n${rd.body}`);
                  setCopied(`Round ${rd.round} copied`); setTimeout(() => setCopied(null), 2500);
                }}>Copy</button>
              </Card>
            ))}
          </div>
        ))}
        {copied && <span className="of-note">{copied}</span>}
        <Note style={{ marginTop: 8 }}>
          <strong>Cadence: </strong>
          {Object.entries(seq.cadence as Rec).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(" · ")}
        </Note>
        <Note style={{ marginTop: 12 }}>{seq.compliance_note as string}</Note>
      </Section>

      <Section kicker="What blocks this today">
        {((seq.gaps as string[]) ?? []).map((x) => <Gap key={x}>{x}</Gap>)}
      </Section>
    </>
  );
}
