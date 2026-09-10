import { useEffect, useMemo, useState } from "react";
import { Note } from "../../../ui";
import { Logo } from "../../../ui";
import { saveCampaign } from "../../../lib/outreachStore";
import { sequencesFile, useAccounts } from "./shared";
import type { Rec } from "../../../data";

/* Creating a campaign: who it is for, what it says, and which companies.

   It deliberately cannot start one. A new campaign is always saved switched
   off, because activating spends Apollo credits and writes to strangers, and
   a mistyped account list should cost nothing until somebody looks at it and
   presses the other button. */

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function NewCampaignModal({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const { rows: accounts } = useAccounts();
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [tier, setTier] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  // Email tiers only. Tier 0 is a LinkedIn sequence whose subject line is
  // literally "(no subject)", and sending it as email would be wrong on its
  // face — the server refuses it too.
  const tiers = ((sequencesFile.sequences as Rec[]) ?? [])
    .filter((s) => (s.tier as number) >= 1);

  const shown = useMemo(() => {
    const needle = find.trim().toLowerCase();
    return accounts
      .filter((a) => !needle || a.company.toLowerCase().includes(needle))
      .slice(0, 60);
  }, [accounts, find]);

  const toggle = (id: string) =>
    setPicked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const missing = !name.trim() ? "give it a name"
    : !persona.trim() ? "say who the message is for"
    : picked.length === 0 ? "pick at least one company"
    : null;

  const save = async () => {
    if (missing) return;
    setBusy(true);
    setErr(null);
    try {
      await saveCampaign({
        id: slug(name), name: name.trim(), persona: persona.trim(),
        template_tier: tier, account_ids: picked,
      });
      onSaved(name.trim());
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="of-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="of-modal__box" onClick={(e) => e.stopPropagation()}>
        <header className="of-modal__h">
          <span>New campaign</span>
          <button className="of-dock__x" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="of-modal__body">
          <label className="of-cw__row">
            <span className="of-cw__k">Name</span>
            <input className="of-cw__v of-chat__in" value={name} disabled={busy}
                   placeholder="e.g. Risk-averse CFOs"
                   onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="of-cw__row" style={{ marginTop: 10, alignItems: "flex-start" }}>
            <span className="of-cw__k" style={{ marginTop: 8 }}>Persona</span>
            <textarea className="of-cw__v of-chat__in" rows={3} value={persona} disabled={busy}
                      placeholder="Who this message is written for — the agent writes to this."
                      onChange={(e) => setPersona(e.target.value)} />
          </label>

          <label className="of-cw__row" style={{ marginTop: 10 }}>
            <span className="of-cw__k">Message</span>
            <select className="of-sel of-cw__v" value={tier} disabled={busy}
                    onChange={(e) => setTier(Number(e.target.value))}>
              {tiers.map((s) => (
                <option key={s.tier as number} value={s.tier as number}>
                  tier {s.tier as number} · {s.tier_name as string}
                </option>
              ))}
            </select>
          </label>
          <Note style={{ marginTop: 6 }}>
            The campaign borrows that tier’s copy whatever tier the companies themselves are.
          </Note>

          <div style={{ marginTop: 18 }}>
            <div className="of-kicker" style={{ marginBottom: 8 }}>
              Companies{picked.length ? ` · ${picked.length} picked` : ""}
            </div>
            <input className="of-chat__in" placeholder="Search companies"
                   value={find} disabled={busy}
                   onChange={(e) => setFind(e.target.value)} />
            <div className="of-pick">
              {shown.map((a) => (
                <button key={a.id} type="button"
                        className={`of-pick__b${picked.includes(a.id) ? " is-on" : ""}`}
                        onClick={() => toggle(a.id)}>
                  <Logo url={a.url} name={a.company} size={16} />
                  <span>{a.company}</span>
                  <span className="of-note">tier {a.tier}</span>
                </button>
              ))}
              {shown.length === 0 && <Note>No company matches that.</Note>}
            </div>
          </div>
        </div>

        <div className="of-cw__f">
          <button className="of-facet__b" disabled={busy || Boolean(missing)}
                  onClick={() => void save()}>
            {busy ? "…" : "Create"}
          </button>
          <button className="of-dock__x" onClick={onClose}>cancel</button>
          <span className="of-note">
            {err ?? missing ?? "Saved switched off — activating is a separate button."}
          </span>
        </div>
      </div>
    </div>
  );
}
