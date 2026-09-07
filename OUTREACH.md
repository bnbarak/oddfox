# The automated CRM — what it is for

This is the plain-English version. No code, no commands. If you want to know
what the system does, why it is built the way it is, and what it will and will
not do on its own, this is the page.

For how to run and deploy it, see [context.md](context.md).

---

## The goal, in one paragraph

We have thirty-eight target companies and about ninety-four named people at
them. Working that list by hand means someone remembering, every morning, who
was written to, who answered, who is overdue a second note, and how much each
company has already had. Nobody does that reliably for more than a fortnight.
So the CRM does it: it writes each message, holds it in a queue you can still
cancel, sends a small number a day from each address, watches for replies, and
shows you at a glance which companies are getting attention and which are being
quietly forgotten.

The point is **not** volume. It is that the right person gets one good, honest
message at the right interval, and that we can see it happening.

---

## What it does

**It writes.** Each message starts from the sequence written for that company's
tier — the argument we have decided to make to ship managers, or to companies
whose vessel was attacked, or to charterers. An agent then makes that argument
fit the actual person: their title, their fleet, and what we have already said
to them. It reads the earlier messages before writing a follow-up, so round two
never arrives as a slightly reworded round one.

**It holds.** Nothing is written and sent in one motion. Every message is
scheduled, which means there is a window — usually the better part of a day —
in which it can be pulled back with one click and nothing has happened. That
window is deliberate. It is the difference between a mistake and an incident.

**It rations.** Each sending address is allowed a fixed number of messages a
day, fifteen by default, and no more. Not fifteen on average; fifteen. When the
day is full the system stops rather than borrowing from tomorrow. Messages are
spread across the working day, roughly one every half hour, rather than going
out in a burst at nine o'clock.

**It listens.** Every minute it checks for replies and for what happened to
what we sent — delivered, opened, bounced, complained. A real reply ends that
person's sequence immediately: nobody gets a follow-up after answering. An
out-of-office does not count as a reply. A bounce or a complaint retires that
address permanently.

**It shows.** One grid: every account down the side, every week across the top.
You can see in three seconds which companies have had nothing for two months
and which have had three messages in a fortnight, which is the failure nobody
notices until someone complains.

---

## What it will not do

- **It will not send without a person.** Follow-ups are prepared automatically
  and then wait. There is a switch that lets them go on their own, and it
  starts off. Turning it on should be a decision somebody makes out loud.
- **It will not invent facts.** The agent may only use what is in the account
  and contact record. No fleet numbers it did not read, no incidents, no
  claims about what a company does today.
- **It will not overstate what we do.** There is a fixed list of things that
  must never be claimed — that an escort prevents attack, that anyone
  currently buys one, any price at all. The agent is given that list and told
  it is not negotiable. It is the same list the research library keeps, for the
  same reason: the honest version of our story is good enough, and the
  dishonest version is unrecoverable.
- **It will not email someone who asked us not to.** A reply that reads as an
  opt-out retires that address at once, before anybody reads it, and there is
  no way to schedule to a retired address.
- **It will not start sending by accident.** Out of the box it has no sending
  addresses, no keys, and a dry-run switch turned on. Every one of those has to
  be changed deliberately, and the panel lists exactly what is still missing.

---

## The rules we send under

Most of our targets are UK or EU companies. Business-to-business email to a
corporate address is generally allowed, but only with a real sender, a real
postal address, and an opt-out that works. So:

- Every message carries a named sender, a postal address, and a line telling
  the recipient how to stop hearing from us.
- The system refuses to send at all until the postal address and the opt-out
  mailbox are filled in. This is not a warning that can be dismissed.
- Opt-outs are honoured immediately and permanently. We delete on request; we
  do not quietly suppress and keep the record.
- Nobody is contacted at a personal address. Every person in this CRM was found
  on a company's own published pages, and the record carries the source and the
  date it was read.

---

## How to tell whether it is working

Four numbers on the Outreach page, in the order they matter:

1. **Human replies.** The only number that means anything. Everything else is
   activity.
2. **Accounts touched, out of thirty-eight.** Coverage. A campaign that has
   worked eight companies hard and ignored thirty has not been run.
3. **Bounces.** More than a couple means the addresses are guesses, and guessed
   addresses damage the sending domain for the real ones.
4. **Messages sent.** Last, on purpose. It is the easiest number to move and
   the least informative.

Below them is the heartbeat: the last time the system checked for replies. If
that timestamp is hours old, nothing is being collected, and the reply you are
waiting for may already have arrived.

---

## Where the risk actually is

Three things would hurt, in order:

1. **Sending too much, too fast, from a new address.** Mailbox providers decide
   quite quickly whether a domain is worth delivering, and the decision is hard
   to reverse. This is why the daily cap is a hard limit enforced in the
   database rather than a setting, and why messages are spaced out.
2. **Sending something untrue.** A single overclaim to a fleet manager, in
   writing, is worse than a hundred ignored emails. Hence the fixed list of
   things that may not be said, and hence a person approving the copy.
3. **Emailing someone who asked us not to.** Cheap to avoid, expensive to get
   wrong, and entirely a matter of doing what the reply said.

None of these are solved by being careful on the day. They are solved by the
system refusing, which is what it does.
