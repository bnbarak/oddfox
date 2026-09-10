---
name: add-sending-domain
description: How to add a new domain to Seaworth outreach, from buying it to it actually sending — registration, DNS, Resend verification, SENDERS, the config document, and the warm-up cap. Use whenever someone wants another domain to send (or receive) outreach mail, asks why a domain shows "not sending yet", or is setting DNS records for Resend.
---

# Adding a sending domain

A domain is ready only when five separate things are true, and each one is a
different system. Skipping one gives a domain that looks done and is not:
bought but invisible, visible but refused, or sending before it was warm.

| # | What | Where it lives | Symptom if missing |
|---|------|----------------|--------------------|
| 1 | Registered, with a DNS zone | Cloud Domains + Cloud DNS, project `costseg-507001` | nothing resolves |
| 2 | Verified in Resend | Resend, region `us-east-1` | every send fails |
| 3 | In `SENDERS` | `server/src/outreach/config.ts` | not listed anywhere; engine refuses with `unknown-sender` |
| 4 | Enabled in the config document | Firestore `crmOutreachMeta/config` → `domains` | listed as "not sending yet" |
| 5 | Warmed | the `daily_cap` in that entry | domain gets filtered as spam — and that does not come back |

Do them in this order. The order is the point.

## 1. Buy it

- Check it is free: `gcloud domains registrations search-domains <name> --project=costseg-507001`
  (shows price too; a `.com` is $12/yr).
- **Create the Cloud DNS zone first**, DNSSEC on, named after the domain with
  dots as dashes (`tryseaworth-com`):
  `gcloud dns managed-zones create <zone> --dns-name=<domain>. --visibility=public --dnssec-state=on --project=costseg-507001`
- Register it into that zone, with contacts copied from an existing
  registration (`gcloud domains registrations describe theseaworth.com --format=json`)
  and `--contact-privacy=redacted-contact-data`, `--cloud-dns-zone=<zone>`.
  It sits in `REGISTRATION_PENDING` for a few minutes; that is normal.
- Registration is a purchase and is not refundable. Confirm with the person first.

`seaworth.ai` is the exception to all of this: its DNS is Squarespace, with no
API. Records there are added by hand.

## 2. Verify it in Resend

Someone adds the domain in the Resend dashboard (with sending, and receiving if
wanted). Then:

- **Take the records from the Resend API, never from a screenshot.** The
  dashboard truncates every value (`p=MIGfMA[…]QIDAQAB`), and a guessed DKIM key
  is a broken one. The key is `RESEND_API_KEY` in Secret Manager, project
  `maine-507401`:
  `GET https://api.resend.com/domains` for the id, then `GET /domains/<id>` for `records`.
- The record set is: DKIM `TXT resend._domainkey`; `CNAME send` and
  `CNAME rsend` → `*.forge.rmta.net`; and, **only if receiving is on**, an apex
  `MX 10 inbound-smtp.us-east-1.amazonaws.com`. Add `TXT _dmarc "v=DMARC1; p=none;"`
  too — Resend lists it as optional and does not return it from the API.
- The DKIM value is longer than 255 characters, and Cloud DNS rejects a TXT
  string that long. Split it into quoted 255-character chunks inside one
  rrdata: `"part1" "part2"`.
- An apex MX makes **every** address on the domain a Resend mailbox. That is
  what an outreach domain wants and what a personal domain does not.
- **Verification is DNS, not mail.** Resend polls for the records. Nothing is
  emailed to anybody and there is no inbox to watch. `POST /domains/<id>/verify`
  asks it to check now; it moves record by record and usually settles within
  the hour. Confirm with `dig @<the domain's own NS>` that the records resolve
  before blaming Resend.

## 3. Add it to SENDERS

One entry in `SENDERS` in `server/src/outreach/config.ts`: the domain, `from_local`
(`barak`), `from_name`. One human sender per domain — scattering local parts on a
young domain is a spam signal, and the list is hardcoded so that who we appear
to be cannot change because a page was edited.

`SENDERS` is also what makes the domain appear in **Settings → Addresses** and
in the **Outreach** quota list. Both pages are driven from it, so a domain in
`SENDERS` shows up — as "not sending yet" — before it is ever switched on.

Land it through the worktree workflow (see the `worktree-workflow` skill). A
merge to `main` deploys the server; check it went with `gh run list --branch main --limit 3`.

## 4. Switch it on — only after 2 and 3

Add an entry to `domains` in the Firestore document `crmOutreachMeta/config`
(project `maine-507401`). Read the document, append, write back inside a
transaction — `domains` is an array, and writing a new array without the
existing entries deletes every other sending domain.

```json
{ "domain": "<domain>", "from_local": "barak", "from_name": "Barak Ben Noon",
  "reply_to": null, "daily_cap": 5, "enabled": true, "manual_only": false,
  "listen_inbound": true, "note": "outreach — added <date>, warming" }
```

Both preconditions matter:

- **Resend not yet verified** → the engine picks the domain and every send fails.
- **Not yet in the deployed `SENDERS`** → an enabled domain with no sender is
  reported as the `unknown-sender` blocker. Check what that blocker stops
  before enabling ahead of a deploy.

For a personal domain: `manual_only: true`, `listen_inbound: false`. The
automation never touches it, and its private mail stays out of the CRM.

## 5. Warm it

Start at 5 a day and step up over two or three weeks toward the 15 the older
domains run at. A domain days old going from nothing to fifteen cold emails a
day is the pattern that gets it filtered, and a burned domain does not recover.

What changes nothing: a new domain only takes **new** sequences. A sequence
keeps the domain it started on for every later round (`startedOn` in
`send.ts`), so adding a domain never moves a conversation already under way.

## Checking it worked

- Settings → Addresses lists the address, with "automated + by hand" and its cap.
- Outreach shows a quota bar for it instead of "not sending yet".
- `server/scripts/outreach-domain-test.ts` still passes.
