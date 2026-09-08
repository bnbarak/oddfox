import { useEffect, useState } from "react";
import { Chip, H1, Note, Section } from "../../../ui";
import {
  putOutreachConfig, useOutreachConfig, useOutreachStatus, type Signature,
} from "../../../lib/outreachStore";

/* Settings: the two things a person actually needs to change.

   Not everything in the config document is here on purpose. Caps, the send
   window and the cadence are deliverability settings that should be changed
   deliberately and rarely, and the sending identities are hardcoded in the
   server precisely so they cannot be edited from a browser. */

const blank = (): Signature => ({ id: `sig-${Date.now().toString(36)}`, name: "", body: "" });

export function CrmSettings() {
  const cfg = useOutreachConfig();
  const status = useOutreachStatus();
  const [sigs, setSigs] = useState<Signature[]>([]);
  const [def, setDef] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    if (cfg.data) { setSigs(cfg.data.signatures); setDef(cfg.data.default_signature); }
  }, [cfg.data]);

  const save = async () => {
    setSaving(true);
    try {
      const clean = sigs.filter((s) => s.name.trim() && s.body.trim());
      await putOutreachConfig({
        signatures: clean,
        default_signature: clean.some((s) => s.id === def) ? def : (clean[0]?.id ?? null),
      });
      await cfg.reload();
      setSaid("Saved.");
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const edit = (id: string, patch: Partial<Signature>) =>
    setSigs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  if (cfg.error) {
    return <><H1>Settings</H1><Note><strong>The CRM server is not answering. </strong>{cfg.error}</Note></>;
  }

  return (
    <>
      <H1>Settings</H1>

      {said && <Note style={{ marginBottom: 14 }}>{said}</Note>}

      <Section kicker="Signatures">
        {sigs.length === 0 && (
          <Note style={{ marginBottom: 12 }}>
            No signatures yet — messages sign off with “{cfg.data?.sender_name}”.
          </Note>
        )}

        {sigs.map((s) => (
          <div key={s.id} className="of-sig">
            <div className="of-sig__h">
              <input className="of-chat__in of-sig__name" placeholder="Name — e.g. Short, Formal"
                     value={s.name} onChange={(e) => edit(s.id, { name: e.target.value })} />
              <label className="of-note of-sig__def">
                <input type="radio" name="defsig" checked={def === s.id}
                       onChange={() => setDef(s.id)} /> default
              </label>
              <button className="of-dock__x"
                      onClick={() => setSigs((p) => p.filter((x) => x.id !== s.id))}>remove</button>
            </div>
            <textarea className="of-chat__in" rows={4} placeholder="Barak Nissim&#10;Seaworth"
                      value={s.body} onChange={(e) => edit(s.id, { body: e.target.value })} />
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button className="of-facet__b" onClick={() => setSigs((p) => [...p, blank()])}>
            Add signature
          </button>
          <button className="of-facet__b" onClick={() => void save()} disabled={saving}>
            {saving ? "…" : "Save"}
          </button>
        </div>

        {/* What a signature cannot do is as important as what it can. */}
        <Note style={{ marginTop: 16 }}>
          Every message ends with the signature, then your postal address and the opt-out line.
          Those two are appended after it and cannot be edited away — they are what makes the
          message lawful to send.
          <pre className="of-mail" style={{ marginTop: 10 }}>
{`…your message

--
${(sigs.find((s) => s.id === def)?.body || cfg.data?.sender_name || "Barak").trimEnd()}
${cfg.data?.postal_address ?? "(no postal address set)"}
Reply "unsubscribe" and you will not hear from me again.`}
          </pre>
        </Note>
      </Section>

      <Section kicker="Addresses you can send from">
        <div className="of-matrix-wrap">
          <table className="of-matrix of-crm">
            <thead>
              <tr><th className="co">Address</th><th>Used by</th><th>Inbound</th><th>Cap/day</th></tr>
            </thead>
            <tbody>
              {(status.data?.senders ?? []).map((x) => {
                const d = cfg.data?.domains.find((y) => y.domain === x.domain);
                return (
                  <tr key={x.domain}>
                    <td className="co"><span className="co-name">{x.address}</span></td>
                    <td className="cell">
                      {x.manual_only
                        ? <Chip tone="warm">by hand only</Chip>
                        : <Chip tone="cool">automated + by hand</Chip>}
                    </td>
                    <td className="cell">
                      {d?.listen_inbound
                        ? <span className="of-note">replies come into the CRM</span>
                        : <span className="of-note">not captured</span>}
                    </td>
                    <td className="val">{d?.daily_cap ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Note style={{ marginTop: 14 }}>
          These are fixed in the server, not editable here — who we appear to be should not change
          because a page was edited. Adding one is a code change.
        </Note>
      </Section>
    </>
  );
}
