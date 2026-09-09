# The outreach engine — read this before changing anything here

This subsystem sends real email to real people at real companies. Most of it
is ordinary code you can change freely. A few things are load-bearing, and
this file is about those.

Plain-English version of *what it is for*: [OUTREACH.md](../../../OUTREACH.md).
How it is deployed and run: [context.md](../../../context.md) at the repo root.

---

## The six things you must not break

**1. `schedule()` in `send.ts` is the only path to Resend.** Every rule that
protects a stranger from us lives on it: the daily cap, the dry-run switch,
the `{{placeholder}}` check, the bounced-address check. If you need to send
from somewhere new, call `schedule()`. Do not add a second `resend.emails.send`
anywhere — a second path is a second set of rules to forget.

**2. The daily cap is a Firestore transaction, and it has to stay one.**
`reserve()` in `store.ts` reads the counter, checks it against the cap, and
writes — atomically. Rewriting that as a read followed by a write looks
identical and is wrong: two requests that both read 14 will both write 15.
This is not a tidiness point. Fifteen a day is a deliverability limit; exceed
it on a young sending domain and mailbox providers start filing everything
from that domain as spam, which does not come back on any useful timescale.

After touching `store.ts`, run:

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/legacy_credentials/admin@biofenix.ai/adc.json \
  npx tsx scripts/outreach-cap-test.ts maine-507401
```

It fires 20 simultaneous claims at a cap of 5 and requires exactly 5 winners.

**3. Nothing is ever sent immediately.** Every message goes out with
`scheduledAt`, even when the slot is two minutes away, because Resend then
holds it and hands back an id that will cancel it. That id *is* the cancel
token. Removing the delay to "send now" would remove the only window in which
a mistake is free.

**4. Resend owns the suppression list. Do not build a second one.** It adds to
it automatically on every bounce and complaint and skips sending to anything
on it, across the whole team. We push to it in exactly one place — when an
inbound reply reads as an opt-out (`poll.ts`) — because that is the one thing
Resend cannot infer. A local list would be a second source of truth that
eventually disagrees with the first, and the failure mode is emailing someone
who asked you not to.

**5. It fails closed, and that is the shipped default.** No domains, no keys,
no postal address, `dry_run: true`. `blockers()` in `config.ts` lists every
reason sending is impossible, and the panel shows all of them at once. If you
add a precondition for sending, add it to `blockers()` too — a check that only
throws at send time is invisible until someone tries.

**6. Apollo enrichment costs money, and the trigger is the expensive part.**
`apollo.ts` buys a work email for somebody we are about to write to. The owner
of the budget set two rules, and both are enforced in code because both are
easy to break with a reasonable-looking edit:

*Enrich at two moments and nowhere else.* **Switching a campaign on**
(`enrichCampaign`, reached from `POST /campaigns/:id/activate` and the
`set-campaign` tool on the transition to active) and **scheduling a message**
to somebody in an active campaign who has no address (`schedule()` in
`send.ts`). Nothing else may buy data. Do not add a "fill in the missing
emails" sweep, a page-load lookup, or a nightly job: a sweep across the People
page is a four-figure invoice and it buys addresses for people nobody has
decided to contact.

Activation was moved earlier deliberately, against the advice in this file's
first version. It spends before any message exists, so a campaign switched on
and then paused has already cost its money. That trade was made knowingly —
the alternative was a first send that silently paused to shop — so do not
"fix" it back without asking.

*Emails only, never phones.* Apollo bills 1 credit for an email and **8 more**
if a mobile number comes back, and the waterfall options fan out to vendors
who charge per lookup even when they find nothing. `REFUSED` in `apollo.ts`
names those four parameters and `outreach-render-test.ts` asserts none of them
appears in the request body. If you find yourself adding one to "get more
data", the cost is nine times what you are expecting and a miss stops being
free.

Two more things that are load-bearing rather than tidy:

- **A miss is a state, not an absence.** The panels distinguish "never looked
  up" from "looked up, Apollo has nothing" — the second renders as *can't
  find* (`EmailCell.tsx`). They are opposite instructions: the first is a
  research job somebody can do, the second is closed. Collapsing them back
  into one empty cell is what invites a retry, and retrying closed lookups is
  the one behaviour that makes this expensive.
- **Misses are cached exactly like hits.** `crmEnrichment/{contact_id}` is
  written whether or not an address was found. A person Apollo has nothing for
  is the most expensive record in the system if that "no" is not written down:
  the campaign stays active, the message still has nowhere to go, and every
  retry asks and pays again. One lookup per contact, ever.
- **A found address is written back to the contact.** `crm.setEmail()` — the
  one write in an otherwise read-only file. We have already paid for it; if it
  lives only in the ledger it is invisible on the People page and the next
  thing that needs it looks it up again. `email_status` is deliberately not
  touched: found is not verified, and only a bounce or a delivery moves it.

`DAILY_CREDIT_CAP` is a backstop, not a budget. Nothing should approach 25
credits a day. If it trips, something is calling enrichment in a loop — find
it rather than raising the number. Spend so far is in `crmEnrichSpend/{day}`.

---

## Traps specific to this code

**zod strips unknown keys.** `schemas.ts` uses plain `z.object()`, and
`SendRecord` is written back whole. A field you add to a document but not to
the schema is silently dropped on the next write, for every record. Add the
field and the schema in the same commit. (This already bit the CRM once, on
`linkedin_source`.)

**Blank is not configured.** Secret Manager will not store an empty payload,
so a secret with no key yet holds a single space — and `" "` is truthy. Read
every key through `secret()` in `config.ts`, never `process.env` directly.
There are currently zero raw reads; keep it that way.

**A dry run must not claim quota.** `schedule()` writes the row and returns
before reserving. Claiming a slot for a message that was never sent would burn
the first live day's budget on nothing.

**Quota is charged to the day the message lands**, in the configured zone, not
the day it was booked. `dayKey()` in `time.ts`. Fifteen queued on Friday for
Tuesday fills Tuesday.

**Cancelling returns the slot.** `cancel()` releases the reservation. If you
add another way for a scheduled message to die, release it there too or the
day quietly loses capacity.

**An out-of-office is not a reply.** `readsAsAutomated()` keeps holiday
responders out of the pipeline; `readsAsOptOut()` is deliberately generous,
because treating a borderline reply as an opt-out costs one lead and the
reverse costs a complaint. Both are pure functions with tests:

```bash
npx tsx scripts/outreach-render-test.ts
```

**An unresolved `{{placeholder}}` is left visible on purpose.** `fill()`
reports what it could not resolve and leaves the braces in, because a blank
reads as finished prose and braces cannot be mistaken for it. `schedule()`
refuses anything still containing them.

---

## Why the two agents are shaped differently

`agent.ts` — **the writer** — has **no tools**, deliberately. Everything one
outreach email depends on is known before we start: the person, the company,
the tier template, the prior messages. They go in the prompt. A tool-calling
loop would be three extra round trips to rediscover facts we already hold.

`operator.ts` — **the operator**, the one you chat to — has eight tools,
deliberately. We cannot know in advance what will be asked of it.

Do not "harmonise" these. They are different jobs.

The operator runs `ToolCallFilter()` and `TokenLimiter(12_000)` as input
processors. The filter drops tool results from *earlier* turns while keeping
the current loop's own, so the agent cannot answer from a headroom figure it
read ten minutes ago and has to look again. That is why the instructions tell
it not to trust its own earlier answers — if you remove the filter, remove
that instruction too, and vice versa.

Tools that change anything call the same functions the HTTP routes call. Keep
it that way: the guarantees live in `send.ts`, not in the model's willingness
to follow instructions. `confirmed_by_operator` on `schedule-email` is
manners, not a guarantee.

---

## Things people reasonably assume and are wrong about

- **There is no second database.** Everything is in the CRM's own Firestore:
  `crmSends`, `crmQuota`, `crmReplies`, `crmTicks`, `crmOutreachMeta`. There
  was briefly a Cloud SQL Postgres for the heat map's `GROUP BY`; it was
  deleted. A few hundred documents a year is not enough work to justify an
  instance. Do not add one back without a real reason.
- **Firestore is the source of truth, not `data/json/crm/*.json`.** Those
  files are a seed. Editing them changes nothing until you re-seed, and
  re-seeding overwrites pipeline state.
- **The heartbeat has no secret.** Cloud Scheduler signs each call with an
  OIDC token for its own service account (`tickAuth.ts`). It used to use a
  shared secret; that was wrong, because Scheduler cannot read Secret Manager
  and the value had to sit in the job config as plaintext.
- **Mastra's memory is not in use.** It needs a storage adapter implementing
  the `memory` domain — libSQL, Postgres, Mongo — and there is no Firestore
  one. The chat thread is one shared document, replayed into `generate()`.
  The processors above work fine without any of that.
- **Tier 0 is a LinkedIn sequence, not an email one.** `isEmailTier()` guards
  it. One of its subject lines is literally "(LinkedIn message, no subject)".

---

## Where to start

| You want to | Look at |
|---|---|
| Change what the emails say | `render.ts`, and `crmMeta/sequences` in Firestore |
| Change how the agent writes | `INSTRUCTIONS` in `agent.ts` |
| Give the chat agent a new ability | a tool in `operator.ts`, calling an existing function |
| Change what is persisted | `store.ts` + `schemas.ts`, **same commit** |
| Change when follow-ups go | `due()` in `tick.ts`, `cadence_days` in config |
| Add a report | `heatmap.ts`, grouped in memory |

Both test scripts run with no keys and no network beyond Firestore. Run them
before you push; they are fast and they cover the parts that hurt.
