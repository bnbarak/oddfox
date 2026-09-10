import { useEffect, useState } from "react";
import { Chip, H1, Note, Section, Split, Sub, Toggle } from "../../../ui";
import {
  putOutreachConfig, restoreOptOut, useOptOuts, useOutreachConfig, useOutreachStatus,
  type Signature,
} from "../../../lib/outreachStore";
import { createApiKey, revokeApiKey, useApiKeys, type MintedKey } from "../../../lib/keysStore";
import { EmailBody } from "./EmailBody";

/* Settings: the few things a person actually needs to change.

   Not everything in the config document is here on purpose. Caps, the send
   window and the cadence are deliverability settings that should be changed
   deliberately and rarely, and the sending identities are hardcoded in the
   server precisely so they cannot be edited from a browser. */

const blank = (): Signature => ({ id: `sig-${Date.now().toString(36)}`, name: "", body: "" });

/** How somebody told us to stop. Worth distinguishing: a click is unambiguous,
    a typed reply was read by a regex and is the one that could be wrong. */
const SOURCE: Record<string, string> = {
  link: "clicked the link",
  "one-click": "their mail client's unsubscribe button",
  reply: "wrote back asking",
  manual: "added here by hand",
};

/* Keys for Claude.

   The agent in the Operator panel and the agent in Claude are the same ten
   tools; what differs is who is driving. A browser proves who it is with a
   Google sign-in, and Claude on a laptop cannot — so it carries one of these
   instead, and the server checks it on the MCP endpoint and nowhere else.

   The key is shown once, here, and never again: what the server stores is its
   hash. Losing it means revoking it and making another, which is cheap. */
function McpAccess() {
  const keys = useApiKeys();
  const [name, setName] = useState("");
  const [minted, setMinted] = useState<MintedKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const url = `${window.location.origin}/api/mcp`;

  const make = async () => {
    setBusy(true);
    try {
      setMinted(await createApiKey(name.trim()));
      setName("");
      setSaid(null);
      keys.reload();
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const drop = async (id: string) => {
    setBusy(true);
    try {
      await revokeApiKey(id);
      if (minted?.id === id) setMinted(null);
      keys.reload();
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <Section kicker="Claude access">
      <Note style={{ marginBottom: 14 }}>
        The outreach agent is also an MCP server, so Claude can run it: the same tools the
        Operator panel uses — find people, draft, schedule, cancel — with the same daily caps
        and the same refusals underneath. A key here is what Claude signs in with.
      </Note>

      {said && <Note style={{ marginBottom: 12 }}>{said}</Note>}
      {keys.error && <Note style={{ marginBottom: 12 }}>{keys.error}</Note>}

      {(keys.data ?? []).length > 0 && (
        <div className="of-matrix-wrap">
          <table className="of-matrix of-crm">
            <thead>
              <tr><th className="co">Key</th><th>Made by</th><th>Last used</th><th /></tr>
            </thead>
            <tbody>
              {(keys.data ?? []).map((k) => (
                <tr key={k.id}>
                  <td className="co">
                    <span className="co-name">{k.name}</span>
                    <Sub> {k.prefix}…</Sub>
                  </td>
                  <td className="cell">
                    <span className="of-note">{k.created_by}, {k.created_at.slice(0, 10)}</span>
                  </td>
                  <td className="cell">
                    <span className="of-note">{k.last_used_at?.slice(0, 10) ?? "never"}</span>
                  </td>
                  <td className="cell">
                    <button className="of-dock__x" disabled={busy}
                            onClick={() => void drop(k.id)}>revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <input className="of-chat__in" style={{ flex: 1, minWidth: 220 }}
               placeholder="what this key is for — e.g. Barak’s laptop"
               value={name} onChange={(e) => setName(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key !== "Enter" || !name.trim()) return;
                 e.preventDefault();
                 void make();
               }} />
        <button className="of-facet__b" disabled={busy || !name.trim()} onClick={() => void make()}>
          {busy ? "…" : "Generate key"}
        </button>
      </div>

      {minted && (
        <Note style={{ marginTop: 14 }}>
          <strong>Copy this now. </strong>
          It is not stored and cannot be shown again — the server keeps only its hash.
          Run this once in a terminal and Claude Code has the agent:
          <pre className="of-mail" style={{ marginTop: 10 }}>
{`claude mcp add --transport http seaworth ${url} \\
  --header "Authorization: Bearer ${minted.key}"`}
          </pre>
        </Note>
      )}
    </Section>
  );
}

export function CrmSettings() {
  const cfg = useOutreachConfig();
  const status = useOutreachStatus();
  const [sigs, setSigs] = useState<Signature[]>([]);
  const [def, setDef] = useState<string | null>(null);
  const [tracked, setTracked] = useState<string[]>([]);
  const [newAddr, setNewAddr] = useState("");
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [page, setPage] = useState<Page>("signatures");
  /** Whether the server can sign unsubscribe links, which decides which of
      the two opt-out wordings a message actually carries. */
  const linkOn = status.data?.configured.unsubscribe_link ?? false;
  const optouts = useOptOuts();
  /** Which address is mid-confirmation for being opted back in. */
  const [restoring, setRestoring] = useState<string | null>(null);

  const doRestore = async (email: string) => {
    setSaving(true);
    try {
      const r = await restoreOptOut(email);
      setSaid(r.restored_status
        ? `${r.email} can be written to again, and is back to “${r.restored_status}”.`
        : `${r.email} can be written to again. Their pipeline status was not recorded ` +
          `at the time, so set it by hand if it still reads “dead”.`);
      setRestoring(null);
      await optouts.reload();
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  useEffect(() => {
    if (cfg.data) {
      setSigs(cfg.data.signatures);
      setDef(cfg.data.default_signature);
      setTracked(cfg.data.tracked_addresses ?? []);
    }
  }, [cfg.data]);

  const save = async () => {
    setSaving(true);
    try {
      const clean = sigs.filter((s) => s.name.trim() && s.body.trim());
      await putOutreachConfig({
        signatures: clean,
        default_signature: clean.some((s) => s.id === def) ? def : (clean[0]?.id ?? null),
        tracked_addresses: tracked,
      });
      await cfg.reload();
      setSaid("Saved.");
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  };

  const edit = (id: string, patch: Partial<Signature>) =>
    setSigs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  /* One page per thing you came here to change, rather than one long scroll.
     They have nothing to do with each other — a signature, a key for Claude,
     which mailbox we watch — so seeing three of them while editing the fourth
     is only noise. The rail turns into a row of buttons under 900px, which is
     what `of-toggle-v` already does everywhere else. */
  const PAGES = [
    { id: "signatures", label: "Signatures" },
    { id: "claude", label: "Claude access" },
    { id: "inbound", label: "Mail we watch" },
    { id: "senders", label: "Addresses" },
    { id: "domains", label: "Domains" },
    { id: "optouts", label: "Opted out" },
  ] as const;
  type Page = (typeof PAGES)[number]["id"];

  /* The outreach config failing used to blank the whole panel. It no longer
     can: keys live behind a different route and are the one thing you might
     come here for *because* the rest is broken. */
  const dead = cfg.error
    ? <Note><strong>The CRM server is not answering. </strong>{cfg.error}</Note>
    : null;

  return (
    <>
      <H1>Settings</H1>

      {said && <Note style={{ marginBottom: 14 }}>{said}</Note>}

      <Split side={<Toggle vertical options={PAGES.map((p) => ({ id: p.id, label: p.label }))}
                           value={page} onChange={setPage} />}>

        {page === "signatures" && (dead ?? <Section kicker="Signatures">
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
            <EmailBody text={`…your message

${(sigs.find((s) => s.id === def)?.body || cfg.data?.sender_name || "Barak").trimEnd()}
${cfg.data?.postal_address ?? "(no postal address set)"}
${linkOn
  ? "Don't want these? Unsubscribe: " + (status.data?.configured.unsubscribe_host ?? "") + "/u/…"
  : 'Reply "unsubscribe" and you will not hear from me again.'}`} />
            {/* The difference between the two wordings is not cosmetic: one is
                a click, the other is composing an email. Say which is live. */}
            <div style={{ marginTop: 10 }}>
              {linkOn
                ? `Each message carries a one-click unsubscribe link of its own, on
                   ${status.data?.configured.unsubscribe_host}. Clicking it stops everything
                   already queued for that person and records who asked and when.`
                : `UNSUBSCRIBE_SECRET is not set on the server, so no links can be signed and
                   messages fall back to asking people to reply. Replies are still read and acted
                   on, but Gmail and Yahoo will not show their own unsubscribe button.`}
            </div>
          </Note>
        </Section>)}

        {page === "claude" && <McpAccess />}

        {page === "inbound" && (dead ?? <Section kicker="Mail we watch">
          {/* Per address, not per domain: the MX record is at the apex, so
              listening to a domain means listening to every mailbox on it.
              This follows one address without pulling in the rest. */}
          {tracked.length === 0 && (
            <Note style={{ marginBottom: 12 }}>
              Nothing tracked individually. Mail still comes in for any domain marked below as
              “replies come into the CRM”.
            </Note>
          )}
          {tracked.map((a) => (
            <div key={a} className="of-track">
              <span className="of-track__a">{a}</span>
              <button className="of-dock__x"
                      onClick={() => setTracked((p) => p.filter((x) => x !== a))}>remove</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input className="of-chat__in" style={{ flex: 1, minWidth: 220 }}
                   placeholder="address to track — e.g. barak@seaworth.ai"
                   value={newAddr} onChange={(e) => setNewAddr(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key !== "Enter") return;
                     e.preventDefault();
                     const a = newAddr.trim().toLowerCase();
                     if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a) && !tracked.includes(a)) {
                       setTracked((p) => [...p, a]); setNewAddr("");
                     }
                   }} />
            <button className="of-facet__b"
                    disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAddr.trim())}
                    onClick={() => {
                      const a = newAddr.trim().toLowerCase();
                      if (!tracked.includes(a)) setTracked((p) => [...p, a]);
                      setNewAddr("");
                    }}>Add</button>
            <button className="of-facet__b" onClick={() => void save()} disabled={saving}>
              {saving ? "…" : "Save"}
            </button>
          </div>
        </Section>)}

        {page === "optouts" && (
          <Section kicker="People who asked to be left alone">
            {/* The evidence, not the enforcement. Resend keeps its own
                suppression list and that is what actually blocks a send; this
                is the record of who asked, when, and how — which is the thing
                you need if somebody ever says they were emailed after opting
                out, and which an exported suppression list cannot tell you. */}
            <Note style={{ marginBottom: 14 }}>
              Nobody here can be written to again — not by a sequence, not by hand, not from a
              second contact record carrying the same address. Anything already queued for them
              was cancelled at the moment they asked.
            </Note>
            {optouts.error && <Note style={{ marginBottom: 12 }}>{optouts.error}</Note>}
            {optouts.data?.records.length ? (
              <div className="of-matrix-wrap">
                <table className="of-matrix of-crm">
                  <thead>
                    <tr><th className="co">Address</th><th>How</th><th>When</th><th>Cancelled</th><th /></tr>
                  </thead>
                  <tbody>
                    {optouts.data.records.map((o) => (
                      /* A restored row stays, greyed. Deleting it would erase
                         the only evidence that they ever asked, which is the
                         thing this table exists to keep. */
                      <tr key={o.email} className={o.restored_at ? "is-restored" : undefined}>
                        <td className="co"><span className="co-name">{o.email}</span></td>
                        <td className="cell">{SOURCE[o.source] ?? o.source}</td>
                        <td className="cell">{o.at.slice(0, 10)}</td>
                        <td className="val">{o.canceled || ""}</td>
                        <td className="cell">
                          {o.restored_at ? (
                            <span className="of-note">opted back in {o.restored_at.slice(0, 10)}</span>
                          ) : restoring === o.email ? (
                            /* Two clicks, never one. Putting somebody back on
                               a list they asked to leave is not an undo — it
                               needs a person to mean it. */
                            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <button className="of-facet__b" disabled={saving}
                                      onClick={() => void doRestore(o.email)}>
                                {saving ? "…" : "Yes, opt back in"}
                              </button>
                              <button className="of-dock__x"
                                      onClick={() => setRestoring(null)}>cancel</button>
                            </span>
                          ) : (
                            <button className="of-dock__x" onClick={() => setRestoring(o.email)}>
                              opt back in
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Note>{optouts.busy ? "Loading…" : "Nobody has opted out."}</Note>
            )}
          </Section>)}

        {page === "senders" && (dead ?? <Section kicker="Addresses you can send from">
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
        </Section>)}

        {page === "domains" && (
          <Section kicker="Domains we own that do not send">
            {/* Kept apart from Addresses on purpose. Everything on that page
                has a reputation to protect; nothing on this one does yet.
                Confusing the two is how a landing-page domain ends up with
                MX records and a cold campaign on it. */}
            <div className="of-matrix-wrap">
              <table className="of-matrix of-crm">
                <thead>
                  <tr><th className="co">Domain</th><th>What it is for</th><th>DNS</th></tr>
                </thead>
                <tbody>
                  {(status.data?.marketing_domains ?? []).map((d) => (
                    <tr key={d.domain}>
                      <td className="co">
                        <span className="co-name">{d.domain}</span>
                        <Sub> {d.registrar}</Sub>
                      </td>
                      <td className="cell">
                        <span className="of-note">{d.purpose}</span>
                      </td>
                      <td className="cell">
                        <span className="of-note">{d.dns_zone}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(status.data?.marketing_domains ?? []).length === 0 && (
              <Note>{status.busy ? "Loading…" : "No marketing domains recorded."}</Note>
            )}

            {(status.data?.marketing_domains ?? []).map((d) => (
              <Note key={d.domain} style={{ marginTop: 12 }}>
                <strong>{d.domain} — </strong>{d.note}
              </Note>
            ))}

            <Note style={{ marginTop: 16 }}>
              None of these can send mail: they are not in the server's sender list, so there is
              no address to send as and the engine refuses rather than inventing one. Moving one
              onto the sending side is DNS, Resend verification and a warm-up — a code change,
              not an edit here. What we send from is under <strong>Addresses</strong>.
            </Note>
          </Section>)}

      </Split>
    </>
  );
}
