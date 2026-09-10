/* Addresses as the To field understands them. Kept apart from the field so
   the inbox can use the same parsing to pick up an address that was typed and
   never turned into a chip. */

export type Recipient = { email: string; contact_id: string | null; name: string | null };

export type Person = {
  id: string; full_name: string;
  email?: string | null; company?: string | null; title?: string | null;
};

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
export const isEmail = (s: string): boolean => EMAIL.test(s);

/** Everything address-shaped in a paste or a typed line. Takes the forms
    people actually copy: a list split by commas, semicolons, lines or spaces,
    and "Ana Ruiz <ana@x.com>" as it comes out of a mail client. Separators
    inside quotes are not separators, so "Ruiz, Ana" <ana@x.com> stays one. */
export function splitAddresses(raw: string): string[] {
  return raw.split(/[,;\n\r]+(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .flatMap((part) => {
      const angle = /<([^>]*)>/.exec(part);
      return angle ? [angle[1]!.trim()] : part.trim().split(/\s+/);
    })
    .map((s) => s.replace(/^mailto:/i, "").trim())
    .filter(Boolean);
}

/** A typed address that belongs to someone in the CRM is that person, so the
    message lands in their thread rather than starting a stranger's. */
export function recipientFor(email: string, people: Person[]): Recipient {
  const e = email.toLowerCase();
  const p = people.find((x) => x.email?.toLowerCase() === e);
  return { email, contact_id: p?.id ?? null, name: p?.full_name ?? null };
}

/** Appends without repeating anyone already there. */
export function mergeRecipients(list: Recipient[], more: Recipient[]): Recipient[] {
  const seen = new Set(list.map((r) => r.email.toLowerCase()));
  const out = [...list];
  for (const r of more) {
    const k = r.email.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(r); }
  }
  return out;
}
