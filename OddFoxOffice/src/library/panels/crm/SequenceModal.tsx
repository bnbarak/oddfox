import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Chip, Note } from "../../../ui";
import type { Rec } from "../../../data";
import { SEND_TONE, sequencesFile } from "./shared";
import { EmailBody } from "./EmailBody";
import type { Thread, ThreadMessage } from "../../../lib/outreachStore";

/* A sequence end to end, for one person.

   The tables answer "what has gone out"; the sequence panel answers "what
   does tier 1 say". Neither answers the question you actually have in front
   of a contact — what has this person had, what are they getting next, and
   what will it say — because the answer is half history and half script.
   This puts the two in one column, round by round.

   Rounds that have happened show the real message. Rounds that have not show
   the template that will be filled, greyed, so it reads as a plan rather
   than as something already done. */

const tierOf = (messages: ThreadMessage[], fallback = 1): number =>
  messages.find((m) => m.template_tier != null)?.template_tier ?? fallback;

const seqFor = (tier: number): Rec | undefined => {
  const list = (sequencesFile.sequences as Rec[]) ?? [];
  return list.find((s) => s.tier === tier) ?? list.find((s) => s.tier === 1);
};

const cadence = (n: number): string => {
  const raw = String((sequencesFile.cadence as Rec)?.[`round_${n}`] ?? "");
  return raw || `round ${n}`;
};

/** A link to the tier's copy on the Sequences page. */
export function SequenceLink({ tier, round }: { tier: number; round?: number }) {
  const s = seqFor(tier);
  return (
    <Link className="of-link of-seq__link" to={`/library/crm-sequences?tier=${tier}`}
          title={`Open the ${s?.tier_name ?? `tier ${tier}`} sequence`}>
      {round ? `round ${round} · ` : ""}{(s?.tier_name as string) ?? `tier ${tier}`}
    </Link>
  );
}

/** The same question one level up: where is every person in this campaign.

    A grid rather than a list of threads, because the useful shape is "round 2
    has gone to four of six" and that is a column, not a scroll. Clicking a
    person drops into their own sequence. */
export function CampaignSequenceModal({ name, accountIds, threads, onClose, onPerson }: {
  name: string;
  accountIds: string[];
  threads: Thread[];
  onClose: () => void;
  onPerson: (t: Thread) => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const mine = threads.filter((t) => t.account_id && accountIds.includes(t.account_id));
  const tier = tierOf(mine.flatMap((t) => t.messages));

  const cell = (t: Thread, n: number) => {
    const m = t.messages.find(
      (x) => x.dir === "out" && x.round === n && x.status !== "canceled");
    if (!m) return <span className="of-dot-off" title={`round ${n} not written yet`} />;
    /* The real status word, not a summary of it. "queued" hid the
       difference between something Resend is holding and something that
       failed, and scheduled is exactly what you want to see here. */
    return (
      <span title={`round ${n} — ${m.status ?? "sent"} · ${new Date(m.at).toLocaleString()}`}>
        <Chip tone={SEND_TONE[m.status ?? "sent"] ?? ""}>{m.status ?? "sent"}</Chip>
      </span>
    );
  };

  return (
    <div className="of-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="of-modal__box of-modal__box--wide" onClick={(e) => e.stopPropagation()}>
        <header className="of-modal__h">
          <span>{name}</span>
          <button className="of-dock__x" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="of-modal__body">
          <div style={{ marginBottom: 14 }}><SequenceLink tier={tier} /></div>
          {mine.length ? (
            <div className="of-matrix-wrap">
              <table className="of-matrix of-crm">
                <thead><tr>
                  <th className="co">Person</th><th>Round 1</th><th>Round 2</th><th>Round 3</th>
                  <th>Replied</th>
                </tr></thead>
                <tbody>
                  {mine.map((t) => (
                    <tr key={t.key}>
                      <td className="co">
                        <button className="co-row co-row--btn" onClick={() => onPerson(t)}
                                title="Open this person's sequence">
                          <span className="co-name">{t.full_name}</span>
                        </button>
                        <span className="co-sub">{t.title || "role unknown"}</span>
                      </td>
                      <td className="val">{cell(t, 1)}</td>
                      <td className="val">{cell(t, 2)}</td>
                      <td className="val">{cell(t, 3)}</td>
                      <td className="val">
                        {t.messages.some((m) => m.dir === "in" && !m.automated)
                          ? <Chip tone="calm">yes</Chip>
                          : <span className="of-dot-off" title="nothing back yet" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Note>Nothing has been written to anyone in this campaign yet.</Note>
          )}
        </div>
      </div>
    </div>
  );
}

export function SequenceModal({ thread, onClose }: { thread: Thread; onClose: () => void }) {
  // Escape closes it, like every other dialog on this machine.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const out = useMemo(
    () => thread.messages.filter((m) => m.dir === "out" && m.round), [thread.messages]);
  const tier = tierOf(out);
  const seq = seqFor(tier);
  const rounds = ((seq?.rounds as Rec[]) ?? []).filter((r) => (r.round as number) >= 1);

  return (
    <div className="of-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="of-modal__box of-modal__box--wide" onClick={(e) => e.stopPropagation()}>
        <header className="of-modal__h">
          <span>{thread.full_name} · {thread.company ?? "—"}</span>
          <button className="of-dock__x" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="of-modal__body">
          <div style={{ marginBottom: 16 }}>
            <SequenceLink tier={tier} />
            {seq?.premise ? <Note style={{ marginTop: 8 }}>{seq.premise as string}</Note> : null}
          </div>

          {rounds.map((r) => {
            const n = r.round as number;
            // A cancelled round is not a round that happened.
            const sent = out.find((m) => m.round === n && m.status !== "canceled");
            return (
              <section key={n} className={`of-seqr${sent ? " is-done" : ""}`}>
                <header className="of-seqr__h">
                  <strong>Round {n}</strong>
                  <span className="of-note">{cadence(n)}</span>
                  {sent
                    ? <Chip tone={SEND_TONE[sent.status ?? "sent"] ?? ""}>{sent.status ?? "sent"}</Chip>
                    : <Chip>not yet</Chip>}
                  {sent ? <span className="of-note">
                    {new Date(sent.at).toLocaleString()}</span> : null}
                </header>

                {sent ? (
                  <>
                    {sent.subject ? <div className="of-msg__subj">{sent.subject}</div> : null}
                    <EmailBody text={sent.body} html={sent.html} />
                  </>
                ) : (
                  <div className="of-seqr__plan">
                    <div className="of-msg__subj">{r.subject as string}</div>
                    <pre className="of-msg__body">{r.body as string}</pre>
                    <Note>Not written yet. The placeholders are filled when it is drafted.</Note>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
