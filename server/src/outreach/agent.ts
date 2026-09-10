import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import * as crm from "./crm.js";
import { secret } from "./config.js";
import { fill, varsFor } from "./render.js";
import { allCampaigns, campaignFor } from "./store.js";
import type { OutreachConfig, SendRecord } from "./schemas.js";

/* The writing agent.

   It writes; it does not send. Scheduling, the daily cap and opt-outs all sit
   behind the schedule route, so the worst a bad generation can do is produce
   a draft somebody has to read. That separation is the whole safety story
   here and should not be collapsed for convenience.

   The agent is given everything it needs in the prompt rather than tools to
   go and fetch it. We know exactly what one outreach email depends on — the
   person, their company, the tier template, and what we already sent them —
   so a tool-calling loop would be three extra round trips to discover facts
   we already hold. */

/** Mirrors data/json/gtm.json's `do_not_claim`. Duplicated here on purpose:
    it is a hard limit on what may be said to a stranger about a product with
    no track record, and it must not vanish because a data file moved. */
const DO_NOT_CLAIM = [
  "That escort prevents attack. Maersk Yorktown was fired on while under a two-destroyer escort.",
  "That escort addresses the majority of incidents. 15 of the 32 successful attacks in H1 2026 were on vessels at anchor, where an escort is irrelevant.",
  "Any current price. The only pricing in this library is from 2012 and is marked low confidence.",
  "That any named company currently buys escort. No company in the customer list has been confirmed to buy any form of armed or escort protection.",
  "That any commercial operator has bought autonomous escort. A deliberate search found no such transaction on record.",
];

const INSTRUCTIONS = `
You write one cold outreach email at a time, for a company that builds
autonomous vessels escorting commercial ships through high-risk passages.

You are given a template for the recipient's tier and round. Treat it as the
argument, not as text to paraphrase. Make it true of this specific person,
using only the facts you are given.

Rules, in order of importance:

1. Invent nothing. If a fact is not in the record you were handed, it does not
   go in the email. No fleet numbers you did not read, no vessel names, no
   incidents, no claims about what the company does today.
2. Never make any of these claims, in any wording:
${DO_NOT_CLAIM.map((c) => `   - ${c}`).join("\n")}
3. Shorter than the template, never longer. Six sentences is a lot. No
   preamble, no "I hope this finds you well", no reciting their job title.
4. One ask, at the end, and small. Twenty minutes, or a yes/no question.
   Never "let me know if you'd like to learn more".
5. Write like one person emailing another. No marketing register, no
   "solutions", no "leverage", no bullet lists.
6. For rounds 2 and 3 you are shown what was already sent. Do not repeat its
   opening line, its subject or its ask. A follow-up that reads like the first
   email is worse than no follow-up.
7. No signature, postal address or opt-out line — those are appended after
   you, and duplicating them looks automated.
8. Leave no {{placeholder}}. If you cannot fill one honestly, rewrite the
   sentence so it is not needed.
`.trim();

const Draft = z.object({
  subject: z.string().min(1).describe("Subject line, lower case, no colon-separated headline."),
  body: z.string().min(1).describe("Plain text body. No signature, no address, no opt-out line."),
  why: z.string().describe("One sentence: what you changed from the template and why."),
});

export type DraftResult = z.infer<typeof Draft> & { template_tier: number; unresolved: string[] };

export const modelConfigured = (): boolean => Boolean(secret("GOOGLE_API_KEY"));

let cached: { model: string; agent: Agent } | null = null;

/** Built on first use, not at import, so the server boots and serves the
    read-only routes with no model key configured. */
function writer(model: string): Agent {
  if (cached?.model !== model) {
    cached = { model, agent: new Agent({
      id: "outreach-writer", name: "Outreach writer", instructions: INSTRUCTIONS, model,
    }) };
  }
  return cached.agent;
}

/** Writes round `round` for one contact. With `useModel` false — or no model
    key — it fills the tier template verbatim, which is a perfectly good
    message and the honest fallback. */
export async function draft(
  contactId: string,
  round: 1 | 2 | 3,
  cfg: OutreachConfig,
  opts: {
    useModel: boolean; guidance?: string | null; prior?: SendRecord[];
    /** Which campaign's copy to write. Given explicitly by every caller on a
        campaign path, because looking it up from the account picks *a*
        campaign containing that account, and once two campaigns can share an
        account that is a coin toss over whose message gets written. */
    campaign_id?: string | null;
  } = { useModel: true },
): Promise<DraftResult> {
  const contact = await crm.contact(contactId);
  if (!contact) throw new Error(`no contact with id ${contactId}`);
  const account = await crm.account(contact.account_id);
  // A campaign borrows another tier's copy for this account on purpose —
  // companies and campaigns/personas are orthogonal, so this overrides the
  // account's own tier rather than being derived from it.
  const campaign = opts.campaign_id
    ? (await allCampaigns()).find((c) => c.id === opts.campaign_id) ?? null
    : await campaignFor(contact.account_id);
  const tier = campaign?.template_tier ?? account?.tier ?? 1;
  if (!crm.isEmailTier(tier)) {
    throw new Error(`tier ${tier} is a LinkedIn sequence, not an email one — do not send it as email`);
  }
  const t = await crm.template(tier, round);
  if (!t) throw new Error(`no sequence template for tier ${tier} round ${round}`);

  const vars = varsFor(account, contact, cfg);
  const body = fill(t.r.body, vars);
  const subject = fill(t.r.subject, vars);

  if (!opts.useModel || !modelConfigured()) {
    return {
      subject: subject.text, body: body.text,
      why: "Template filled verbatim; no model involved.",
      template_tier: tier,
      unresolved: [...new Set([...body.unresolved, ...subject.unresolved])],
    };
  }

  const prompt = [
    `Write round ${round} to ${contact.full_name}, ${contact.title || "role unknown"} at ${contact.company ?? "an unknown company"}.`,
    account ? `Company facts on record: tier ${account.tier} (${account.tier_name}), ` +
      `${account.fleet ? `${account.fleet} vessels` : "fleet size unknown"}` +
      `${account.country ? `, ${account.country}` : ""}` +
      `${account.vessel_attacked?.length ? `, vessel attacked: ${account.vessel_attacked.join(", ")}` : ""}.`
      : `No company record.`,
    ``,
    `The tier ${tier} template ("${t.seq.tier_name}") argues this:`,
    t.seq.premise ? `Premise: ${t.seq.premise}` : ``,
    campaign ? `\nThis account is in the "${campaign.name}" campaign — write for the persona ` +
      `"${campaign.persona}", not a generic tier ${tier} reader.` : ``,
    `Subject: ${subject.text}`,
    `Body:`,
    body.text,
    body.unresolved.length
      ? `\nThese variables could not be filled from the record: ${body.unresolved.join(", ")}. ` +
        `Rewrite around them — do not guess a value and do not leave the braces in.`
      : ``,
    opts.prior?.length
      ? `\nAlready sent to this person:\n` +
        opts.prior.map((p) => `— round ${p.round}, subject "${p.subject}":\n${p.body}`).join("\n\n")
      : ``,
    opts.guidance ? `\nExtra steer from the operator: ${opts.guidance}` : ``,
  ].filter(Boolean).join("\n");

  const res = await writer(cfg.model).generate(prompt, { structuredOutput: { schema: Draft } });
  const out = res.object;

  // The instructions forbid leftover placeholders, but a model is not a
  // validator. Anything still unresolved is reported, and the schedule route
  // refuses to send it.
  const check = fill(`${out.subject}\n${out.body}`, vars);
  return { ...out, template_tier: tier, unresolved: check.unresolved };
}
