import { useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import {
  isEmail, mergeRecipients, recipientFor, splitAddresses, type Person, type Recipient,
} from "./recipients";

/* The To field, the way every mail client does it: an address becomes a chip
   once you finish it — comma, semicolon, Enter, or a paste of a whole list —
   and a chip can be clicked to fix it in place or crossed out.

   Each chip is one person and, when sent, one message. That is deliberate, not
   a limit of the field: every send carries its own unsubscribe link, its own
   cap and opt-out check, and threads onto that person's own conversation.
   Thirty addresses on one To line would show every recipient to every other
   and give none of them a thread. */

const openQuote = (s: string) => (s.match(/"/g)?.length ?? 0) % 2 === 1;

export function RecipientField({ value, onChange, text, onText, people, disabled }: {
  value: Recipient[];
  onChange: (next: Recipient[]) => void;
  /** What is typed but not yet a chip. Owned by the caller, so a send can
      pick up an address somebody typed and never finished. */
  text: string;
  onText: (next: string) => void;
  people: Person[];
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [hi, setHi] = useState(0);
  // Backspace on an empty box arms the last chip; a second one removes it.
  // Deleting on the first press loses an address to a stray keystroke.
  const [armed, setArmed] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  // Enter ends an edit and unmounts its input, which may or may not fire a
  // blur depending on the browser. The ref makes the second call a no-op.
  const editingRef = useRef<number | null>(null);

  const q = text.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q || isEmail(q)) return [];
    const taken = new Set(value.map((r) => r.email.toLowerCase()));
    // Only people with an address can be written to; a list of names that
    // cannot be picked is worse than a shorter list.
    return people
      .filter((p) => p.email && !taken.has(p.email.toLowerCase()))
      .filter((p) => `${p.full_name} ${p.company ?? ""} ${p.title ?? ""} ${p.email}`
        .toLowerCase().includes(q))
      .slice(0, 40);
  }, [people, value, q]);
  const cur = matches[Math.min(hi, matches.length - 1)];

  const add = (emails: string[]) =>
    onChange(mergeRecipients(value, emails.map((e) => recipientFor(e, people))));

  /** `rest` is whatever came after the separator that finished this one,
      which stays in the box to become the next. */
  const pick = (p: Person, rest = "") => {
    onChange(mergeRecipients(value, [{ email: p.email!, contact_id: p.id, name: p.full_name }]));
    onText(rest); setHi(0);
    input.current?.focus();
  };

  /** Turns what is in the box into chips. Text with no @ in it is a search,
      and finishing it picks the highlighted person — "Sebastian," means
      Sebastian. Anything else becomes chips as written, bad ones included,
      so an address that did not parse shows up red where you can fix it. */
  const commit = (raw: string, rest = "") => {
    const trimmed = raw.trim();
    if (!trimmed) { onText(rest); return; }
    if (!trimmed.includes("@")) {
      if (cur) pick(cur, rest); else { add([trimmed]); onText(rest); }
      return;
    }
    add(splitAddresses(trimmed)); onText(rest); setHi(0);
  };

  /* A separator that arrives without a key press — a phone keyboard, an
     IME, autocomplete, a dictated comma — finishes an address all the same.
     The keydown handler catches the ordinary case first; this is the rest. */
  const onType = (v: string) => {
    setHi(0); setArmed(null);
    const m = /^([\s\S]*)[,;\n]([^,;\n]*)$/.exec(v);
    if (m && !openQuote(m[1]!)) { commit(m[1]!, m[2]!.trimStart()); return; }
    onText(v);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Backspace" || e.key === "Delete") && !text && value.length) {
      e.preventDefault();
      const last = value.length - 1;
      if (armed === last) { onChange(value.slice(0, -1)); setArmed(null); } else setArmed(last);
      return;
    }
    setArmed(null);
    if (e.key === "ArrowDown" && matches.length) {
      e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); return;
    }
    if (e.key === "ArrowUp" && matches.length) {
      e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); return;
    }
    if ((e.key === "," || e.key === ";") && openQuote(text)) return;
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      commit(text);
      return;
    }
    // Space finishes an address, but not a search: "ana ruiz" is one query.
    if (e.key === " " && isEmail(text.trim())) { e.preventDefault(); commit(text); return; }
    // Tab takes the highlighted person and moves on, as it does everywhere.
    if (e.key === "Tab" && cur && !text.includes("@")) pick(cur);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!pasted.includes("@")) return; // a name to search for — paste it as text
    e.preventDefault();
    const el = e.currentTarget;
    const next = text.slice(0, el.selectionStart ?? text.length) + pasted
      + text.slice(el.selectionEnd ?? text.length);
    const parts = splitAddresses(next);
    // One half-finished address is still being typed; leave it in the box.
    if (parts.length === 1 && !isEmail(parts[0]!)) { onText(next); return; }
    add(parts); onText(""); setHi(0);
  };

  // Leaving the box keeps finished addresses and leaves a search alone.
  const onBlur = () => {
    const parts = splitAddresses(text);
    if (parts.length && parts.every(isEmail)) { add(parts); onText(""); }
    setArmed(null);
  };

  const startEdit = (i: number) => {
    if (disabled) return;
    editingRef.current = i;
    setEditing(i); setEditText(value[i]!.email); setArmed(null);
  };

  /** Puts the edited address back where it was, not at the end. An edit that
      turns into two addresses becomes two chips; one emptied out goes away.
      Focus goes back to the box only when the edit was ended from the
      keyboard. Ended by clicking into the subject, it belongs in the subject —
      pulling it back sends the next thing typed into the wrong field. */
  const finishEdit = (keep: boolean, refocus: boolean) => {
    const i = editingRef.current;
    if (i === null) return;
    editingRef.current = null;
    setEditing(null);
    if (keep) {
      const fixed = splitAddresses(editText).map((e) => recipientFor(e, people));
      onChange(mergeRecipients(value.slice(0, i), [...fixed, ...value.slice(i + 1)]));
    }
    if (refocus) input.current?.focus();
  };

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || ((e.key === "," || e.key === ";") && !openQuote(editText))) {
      e.preventDefault(); finishEdit(true, true);
    } else if (e.key === "Escape") {
      // Stop it here, or the window hears it too and shrinks the composer.
      e.preventDefault(); e.stopPropagation(); finishEdit(false, true);
    }
  };

  return (
    <div className="of-rcpt-wrap">
      <div className={`of-rcpt${disabled ? " is-off" : ""}`}
           onMouseDown={(e) => {
             if (e.target === e.currentTarget) { e.preventDefault(); input.current?.focus(); }
           }}>
        {value.map((r, i) => {
          if (editing === i) {
            return (
              <input key={`edit-${i}`} className="of-rcpt__edit" autoFocus value={editText}
                     size={Math.max(6, editText.length + 1)} aria-label="Edit address"
                     onChange={(e) => setEditText(e.target.value)}
                     onKeyDown={onEditKey} onBlur={() => finishEdit(true, false)} />
            );
          }
          const bad = !isEmail(r.email);
          return (
            <span key={r.email.toLowerCase()}
                  className={`of-rcpt__c${bad ? " is-bad" : ""}${armed === i ? " is-armed" : ""}`}
                  title={bad ? "Not an email address — click to fix"
                    : r.name ? `${r.name} <${r.email}> — click to edit` : `${r.email} — click to edit`}>
              <button type="button" className="of-rcpt__t" disabled={disabled}
                      onClick={() => startEdit(i)}>
                {r.name ?? r.email}
              </button>
              <button type="button" className="of-rcpt__x" disabled={disabled}
                      aria-label={`Remove ${r.email}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onChange(value.filter((_, j) => j !== i)); setArmed(null); }}>
                ×
              </button>
            </span>
          );
        })}
        <input ref={input} className="of-rcpt__in" value={text} disabled={disabled}
               placeholder={value.length ? "" : "Name, company or role — or paste addresses"}
               aria-label="Recipients"
               onChange={(e) => onType(e.target.value)}
               onKeyDown={onKey} onPaste={onPaste} onBlur={onBlur} />
      </div>

      {q && !isEmail(q) && editing === null && (matches.length > 0 || !q.includes("@")) && (
        <div className="of-to" role="listbox" aria-label="People in the CRM">
          {matches.length === 0 ? (
            <span className="of-note of-to__none">
              Nobody matches. Type or paste a full address to write to someone outside the CRM.
            </span>
          ) : matches.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={p === cur}
                    className={`of-to__b${p === cur ? " is-hi" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHi(matches.indexOf(p))}
                    onClick={() => pick(p)}>
              <strong>{p.full_name}</strong>
              <span className="of-note"> · {p.title || "role unknown"} · {p.company ?? "—"} · {p.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
