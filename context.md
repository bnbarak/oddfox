# Context

Working knowledge that is not obvious from the code. Read this before touching
the CRM, the data files, or a deploy. For routine site tasks (PDF password,
replacing the deck) see [UPDATING.md](UPDATING.md).

Last updated: 2026-09-09.

---

## The shape of the thing

Everything Seaworth lives in the **`maine-507401`** GCP project (number
209354378060, Firebase display name "Maine"). It used to live in
`vocal-vigil-497322-k8`, whose display name is **biofenix** and which is a
different product's project — it holds a `clinical` database and biofenix's
own keys. That was a mistake and was undone on 2026-09-06.

| Piece | Lives at | Source | Notes |
|---|---|---|---|
| Marketing site | <https://seaworth.web.app> | repo root (`index.html`, `assets/`) | no build step |
| Office app | <https://seaworth-office.web.app> | `OddFoxOffice/` (Vite + React 19) | `npm run build` first |
| CRM API | `/api/**` on the office site | `server/` (Express + zod) | Cloud Run `seaworth-crm-server`, `us-central1` |
| Heartbeat | Cloud Scheduler `seaworth-crm-heartbeat` | — | every minute, POSTs `/tasks/tick` |

The office app is a data library of panels plus slide decks. Panels live in
`OddFoxOffice/src/library/panels/`, registered in `library/Library.tsx` as a
two-level nav: `GROUPS` (top row) → `TABS` filtered by group (second row).

**Still in biofenix, not yet moved:** the five custom domains. `oddfox.ai`,
`www.oddfox.ai`, `seaworth.ai`, `office.oddfox.ai` and `office.seaworth.ai` are
all `CERT_ACTIVE` on the old project's `vocal-vigil-497322-k8` and
`oddfox-office` sites. Moving a domain means removing it there and adding it in
Maine, and the certificate re-provisions from scratch — minutes to ~24h of
downtime for that name. Do it deliberately, not as a side effect.

`firebase.json` therefore carries **four** hosting entries: the two old sites
(which still serve the live domains) and the two new ones. `.firebaserc`
defaults to `maine-507401` with a `biofenix` alias for the old project.

### `firebase deploy` does not work on this machine

It is OOM-killed — exit 137, no output, about a second in — because the CLI
wants more memory than is free. Use the REST deployer instead, which streams
one file at a time and needs a few megabytes:

```bash
node tools/hosting-deploy.mjs seaworth-office --project maine-507401
node tools/hosting-deploy.mjs seaworth        --project maine-507401
node tools/hosting-deploy.mjs vocal-vigil-497322-k8 --project vocal-vigil-497322-k8
```

It reads the site's block out of `firebase.json`, so headers, `cleanUrls` and
rewrites match what the CLI would have produced. Two translations it has to do,
because the REST shape is not the file's shape: `source` → `glob`, and a header
block's list of `{key, value}` becomes a map. `trailingSlash: false` becomes
`trailingSlashBehavior: "REMOVE"`.

### Never publish the repo root without checking the ignore list

The marketing site's `public` is `.`, the repo root, so **anything not in
`ignore` is on the public internet**. `UPDATING.md` was served at
`https://oddfox.ai/UPDATING.md` with the PDF gate password in plain text until
2026-09-06, and the next deploy would have published all of `server/`,
including `src/auth.ts` with the OAuth client id and the email allow-list.
`*.md`, `server/**`, `.claude/**` and `.firebase/**` are excluded now. Run
`node tools/hosting-deploy.mjs <site> --dry` and read the file list before any
deploy that touches the root.

### Two credential gotchas that cost an hour each

**Cloud Run does not set `GOOGLE_CLOUD_PROJECT`.** It sets `K_SERVICE`,
`K_REVISION` and `K_CONFIGURATION` and nothing else. `server/src/firebaseApp.ts`
falls through to a hardcoded project id when it is missing, so a service
deployed without it quietly talks to *another project's* Firestore and fails
with a bare gRPC `PERMISSION_DENIED` that names nothing. Always pass
`--update-env-vars GOOGLE_CLOUD_PROJECT=<project>`.

**ADC does not need a browser.** `gcloud auth application-default login` was
believed to be the only route; it is not. gcloud already stores user
credentials with a refresh token, and firebase-admin accepts them:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/legacy_credentials/admin@biofenix.ai/adc.json
npx tsx scripts/outreach-cap-test.ts maine-507401
```

That unblocks every local script that talks to Firestore.

## Where CRM data actually lives

This moved recently and is the single most confusing thing in the repo.

- `data/json/crm/{accounts,contacts,sequences}.json` — **a seed, not the live
  store.** Edited by hand and by research passes.
- **Firestore is the source of truth at runtime**, in collections `crmAccounts`,
  `crmContacts`, `crmMeta/sequences`.
- `server/src/index.ts` picks the backend: `FirestoreCrmRepository` by default,
  `JsonFileCrmRepository` when `CRM_REPO=json`.

So **editing the JSON files does not change what the app shows.** You have to
re-seed:

```bash
npm run migrate --prefix server     # overwrites Firestore docs from the JSON
```

The migration uses `set`, so it is safe to re-run — but it **overwrites pipeline
state** (`status`, `owner`, `last_touch`, `sequence`, `notes`) with whatever the
JSON says. If someone has been working the pipeline in the app, migrating will
revert their edits. Check before running it.

To work offline against the JSON without touching Firestore:

```bash
CRM_REPO=json PORT=8788 npm run dev --prefix server
```

### The app degrades honestly

`OddFoxOffice/src/library/panels/crm/shared.ts` falls back to the JSON bundled
at build time whenever the API does not answer, and `ServerState.tsx` shows a
"Read-only" banner. So a dead or forbidden API shows correct data that cannot be
edited, rather than an empty table. **If you see that banner in production, the
API is down — the data is not wrong.**

### zod strips unknown keys — this will eat your data

`server/src/schemas.ts` uses plain `z.object()`, which **drops fields not in the
schema**. Because `patch*` does read → merge → write-whole-file, one PATCH will
silently erase any field you added to the JSON but not to the schema, for every
record. When you add a field to a record, add it to `AccountRecord` /
`ContactRecord` in the same commit. `linkedin_url` and `linkedin_source` are
already there.

---

## Collection rules for people

Enforced by hand, stated in `contacts.json` under `collection_rules`. They exist
for legal and ethical reasons, not style:

- Published corporate sources only — leadership pages, press releases, filings.
- Name and title **as published**. Nothing inferred.
- No personal emails, personal phones, or home addresses. Ever.
- A LinkedIn profile URL is a published professional identifier and may be
  stored. Nothing from behind a login.
- Every person carries `source_url` and `retrieved`.
- Delete on request, do not suppress.

Pure HR, finance, audit, legal and IT roles are deliberately **not** collected —
they are not a buying role for this product and only add noise.

`priority` follows `contacts.json`'s `role_map`: 1 = CSO / DPA / HSQE / fleet /
technical (the operational buyer), 2 = COO, operations, risk, insurance,
3 = chartering, commercial, CEO fallback.

---

## Traps found the hard way

- **"CSO" is ambiguous and dangerous.** At Star Bulk it means Chief *Strategy*
  Officer; at NYK, Chief Safety Officer (Marine). Never classify on the
  abbreviation — read the bio and record the expanded title.
- **JS-rendered leadership pages defeat naive scraping.** V.Group was recorded
  as "publishes no named leadership" when it actually publishes two full team
  pages. Use Firecrawl (renders JS), not curl + grep.
- **Wilhelmsen publishes LinkedIn URLs on its own leadership page** — the
  cheapest verified profiles in the whole set. Worth checking whether other
  companies do the same before searching.
- **Logos are derived, not stored.** `ui/Logo.tsx` builds a Google favicon URL
  from the host of `url`. No `url` means a monogram fallback — so a missing
  logo is a missing website, not a broken image.
- **Company `linkedin_url` is only carried where there is no website**, so every
  row has somewhere to point.

### Facts with a shelf life

- **Hafnia:** Mikael Skov stepped down as CEO 2026-09-01; Søren Steenberg Jensen
  holds the role. Skov was proposed for the board at the 2026-09-23 EGM.
- **Golden Ocean:** taken over by CMB.TECH in Aug 2025 and delisted. Its site's
  TLS certificate is invalid — `https://www.goldenocean.no/` fails, http works.
- **Navios:** the IR governance page and a later press release disagree on
  whether Angeliki Frangou or George Achniotis is CEO. Confirm before writing.
- Companies that publish **no** named leadership at all: Delta Tankers,
  Navibulgar, Allseas Marine, Columbia Shipmanagement, Oldendorff Carriers.

---

## The outreach engine

`server/src/outreach/` — writes, schedules, sends and reviews outreach email.
Roughly 1,400 lines. What it is *for*, in plain English with no tech, is
[OUTREACH.md](OUTREACH.md).

**One database.** Everything persists in the same Firestore the CRM already
uses: `crmSends`, `crmQuota`, `crmReplies`, `crmTicks`, `crmOutreachMeta`,
`crmOptOuts`.
There was briefly a Cloud SQL Postgres for this; it was deleted. At fifteen
messages a day the reports are built by reading the documents and grouping in
memory, which is cheaper in every sense than running an instance to `GROUP BY`.

**Resend owns everything Resend already does.** Scheduling is `scheduledAt` on
the send, and the email id it returns *is* the cancel token — that is why
campaign mail is never sent immediately. Hand-written mail (New email, Reply)
is the exception: it goes the moment it is sent, with no scheduledAt, and so
cannot be cancelled. Delivery suppression is Resend's list, which it adds to
automatically on every bounce and complaint and skips sending to across the
whole team; there is no second copy of it.

**Unsubscribing is ours, because it is more than a suppression.** Every
commercial message carries a signed one-click link on
`unsubscribe.seaworth.ai`, plus the `List-Unsubscribe` and
`List-Unsubscribe-Post` headers that make Gmail and Yahoo show their own
button. Clicking it — or writing back "unsubscribe", or being added by hand —
runs one path, `optOut()` in `server/src/outreach/optout.ts`: it records who
asked and when in `crmOptOuts`, **cancels every message already queued for
them**, and marks the contact dead. **The opt-out list is a marketing list.**
`send.ts` refuses an opted-out address for campaign rounds only — by
*address*, so a second contact record carrying it is caught too — and lets
hand-written mail through. That is why an opt-out is deliberately *not* added
to Resend's suppression list: that list is account-wide and would silently
drop the hand-written mail too. See `server/src/outreach/context.md`.

**The daily cap is the one real invariant.** Fifteen a day per sending domain,
enforced in a Firestore transaction, because two requests that both read 14
must not both write 15 — exceeding it on a young domain gets the domain filed
as spam and that does not come back. `scripts/outreach-cap-test.ts` proves it:
20 simultaneous claims against a cap of 5 yield exactly 5. Run it after
touching `store.ts`.

**Two agents, and the difference matters.** `agent.ts` is the *writer*: a
Mastra `Agent` with structured output and deliberately **no tools**, because
everything one outreach email depends on is known before we start, so it all
goes in the prompt. `operator.ts` is the *operator*, the one you chat to, and
it has eight tools, because we cannot know in advance what will be asked. Both
run on Gemini through Mastra's model router (`google/gemini-2.5-pro`, set in
the config document); the router reads `GOOGLE_API_KEY` itself. Without that
key the writer degrades to filling the tier template verbatim and the chat
route answers 409 with an explanation.

**Chat context is managed by two stock processors, not by hand.**

- `ToolCallFilter()` drops tool calls and results from *earlier* turns while
  leaving the current loop's own results in place. The agent can reason about
  what it just looked up, but next turn it has no stale numbers to answer
  from and must call the tool again — which is what you want when the
  pipeline moves under it. Filtering is transient: the stored thread keeps
  everything, only the model's view is trimmed.
- `TokenLimiter(12_000)` is the hard ceiling underneath. It preserves system
  messages and keeps the most recent turns, so a long conversation degrades
  by forgetting its beginning rather than by failing.

**One shared thread, in Firestore.** `crmOutreachMeta/thread`, capped at 80
turns, appended in a transaction. Mastra's own memory and threads need a
storage adapter implementing the `memory` domain — libSQL, Postgres, Mongo —
and there is no Firestore one, so using them would mean a second database for
eighty chat messages. The processors above are plain processors and work
without any of that. One thread rather than one per person is deliberate: two
people are on the allow-list working the same pipeline, and a thread each
would have the agent telling one of them about messages the other scheduled.

**It fails closed.** With no domains, no keys, no postal address and `dry_run`
on, nothing can be sent, and `/api/crm/outreach/status` lists every blocker at
once. That is the shipped default; turning it on is a deliberate act.

Tests that need no keys and no network:

```bash
npx tsx scripts/outreach-render-test.ts     # the compliance rails
GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/legacy_credentials/admin@biofenix.ai/adc.json \
  npx tsx scripts/outreach-cap-test.ts maine-507401
```

---

## Deploying

```bash
npm run build --prefix OddFoxOffice
node tools/hosting-deploy.mjs seaworth-office --project maine-507401
node tools/hosting-deploy.mjs seaworth        --project maine-507401

gcloud run deploy seaworth-crm-server --project maine-507401 --region us-central1 \
  --source server \
  --update-env-vars GOOGLE_CLOUD_PROJECT=maine-507401 \
  --no-invoker-iam-check
```

Note what is NOT in that command: secrets. `RESEND_API_KEY`, `GOOGLE_API_KEY`,
`APOLLO_API_KEY` and `UNSUBSCRIBE_SECRET` are already attached to the service
and survive a deploy that does not mention them. That is also why
`.github/workflows/deploy.yml` can deploy on every push without holding any of
them.

**`--set-secrets` REPLACES the whole set. It does not add to it.** This
document used to carry a `--set-secrets TICK_TOKEN=oddfox-crm-tick-token:latest`
line, left over from before the heartbeat moved to OIDC — that secret does not
exist in this project. Running it silently dropped Resend, Gemini and Apollo
from the service template and then failed on the missing secret, which is a
service that starts fine and cannot send, draft or enrich. To add one secret,
use `--update-secrets`:

```bash
gcloud run deploy seaworth-crm-server --project maine-507401 --region us-central1 \
  --source server --update-secrets NEW_THING=new-thing:latest --no-invoker-iam-check
```

To check what the *next* deploy will ship — not what is currently serving,
which is a different thing and the one that hides this mistake:

```bash
gcloud run services describe seaworth-crm-server --project maine-507401 \
  --region us-central1 --format="value(spec.template.spec.containers[0].env)" | tr ';' '\n'
```

### unsubscribe.seaworth.ai

The unsubscribe link in every commercial message. Its own hostname rather than
a path on the office app, because the office app is behind a Google sign-in
check and this cannot be — keeping them on separate hosts makes that
impossible to get wrong by accident. The site serves no files of its own:
`hosting/unsubscribe` is empty and every request is rewritten to
`seaworth-crm-server`, which renders the page (`outreach/unsubscribe.ts`).

One-time setup, in order:

```bash
# 1. The signing key. Must be STABLE — rotating it breaks every link already
#    sitting in somebody's inbox, because a token is derived from the address
#    rather than stored.
openssl rand -base64 32 | gcloud secrets create seaworth-unsubscribe-secret \
  --project maine-507401 --data-file=-

# 2. The hosting site, then deploy it.
firebase hosting:sites:create seaworth-unsubscribe --project maine-507401
node tools/hosting-deploy.mjs seaworth-unsubscribe --project maine-507401
```

3. Register the custom domain. The console works, but the CLI's credentials
   expire constantly on this machine and the REST API is what
   `tools/hosting-deploy.mjs` already uses:

```bash
TOK=$(gcloud auth print-access-token)
curl -s -X POST -H "authorization: Bearer $TOK" \
  -H "x-goog-user-project: maine-507401" -H "content-type: application/json" -d '{}' \
  "https://firebasehosting.googleapis.com/v1beta1/projects/maine-507401/sites/seaworth-unsubscribe/customDomains?customDomainId=unsubscribe.seaworth.ai"

# then read requiredDnsUpdates and cert.verification.dns off:
curl -s -H "authorization: Bearer $TOK" -H "x-goog-user-project: maine-507401" \
  "https://firebasehosting.googleapis.com/v1beta1/projects/maine-507401/sites/seaworth-unsubscribe/customDomains/unsubscribe.seaworth.ai"
```

4. **seaworth.ai is on Squarespace, not Cloud DNS** — the other domains are in
   `costseg-507001` but this one is edited by hand, so the records go in
   Squarespace's DNS panel. Firebase issued a CNAME here, not the pair of A
   records its older documentation describes:

   | Host (relative — Squarespace appends the domain) | Type | Data |
   |---|---|---|
   | `unsubscribe` | CNAME | `seaworth-unsubscribe.web.app` |
   | `_acme-challenge.unsubscribe` | TXT | the Let's Encrypt token from `cert.verification.dns.desired` |

   The TXT is only needed until the certificate issues, but leaving it costs
   nothing and helps on renewal. Poll the GET above until `ownershipState` is
   `OWNERSHIP_ACTIVE` and `hostState` is `HOST_ACTIVE`.

   Until DNS resolves and the certificate is issued, `canLink()` is still true
   and messages will carry links that 404 — so do this **before** the secret
   exists, and before turning `dry_run` off.

Until `UNSUBSCRIBE_SECRET` exists the system is not broken: `canLink()` is
false, no links are minted, and commercial mail falls back to asking people to
reply — which `poll.ts` reads and acts on. Settings → Signatures says which of
the two is live.

Cloud Run in Maine cannot be made public with an `allUsers` IAM binding — an
org policy on permitted domains refuses it. It uses
`--no-invoker-iam-check` instead, which is how the old service was configured
too. Firebase Hosting rewrites need anonymous access to reach the service; the
real access boundary is `server/src/auth.ts`, which checks a Google ID token on
every `/api` route, and `TICK_TOKEN` on `/tasks/tick`.

There is exactly one exception, `/api/mcp`, and it is deliberate.
`server/src/index.ts` mounts it **above** the blanket `requireGoogleUser` line,
because Express matches routes in order — anything added below that line is
still covered, and nothing else belongs above it. It authenticates with an API
key instead (`server/src/apiKeys.ts`): 32 random bytes, stored only as a
SHA-256 which is also the document id, so a read of `crmApiKeys` yields nothing
usable. Keys are minted in the office app under Settings → Claude access, shown
once, and revoked by deleting the document. The endpoint itself is the outreach
agent's ten tools over MCP (`server/src/outreach/mcp.ts`) — the same
`operator.ts` tool objects the onsite agent uses, so `send.ts` still enforces
the cap, dry-run and placeholder checks underneath Claude exactly as it does
underneath the panel.

To connect Claude Code to it:

```bash
claude mcp add --transport http seaworth https://seaworth-office.web.app/api/mcp --header "Authorization: Bearer sw_..."
```

Re-seeding Firestore from `data/json/crm/*.json` needs no ADC:

```bash
node server/scripts/seed-firestore-rest.mjs maine-507401
```

It writes whole documents, so it **overwrites pipeline state**. Check nobody is
mid-campaign first.

To confirm what is live, compare the deployed bundle hash to the local one
rather than trusting a deploy log:

```bash
curl -s https://seaworth-office.web.app/ | grep -o '/assets/main-[^"]*\.js'
ls OddFoxOffice/dist/assets/main-*.js
```

---

## Working alongside other agents

Several agents edit this repo at once. **Each one works in its own git worktree,
on its own branch, and lands it through a PR it merges itself.** The mechanics —
the exact commands, naming, cleanup — are the `worktree-workflow` skill in
`.claude/skills/`. What follows is why, and what still bites.

**Nobody claims `main`.** `/Users/barak/oddfox` stays on `main` and moves only
by `git pull --ff-only`. It is the integration point, not a desk. Git enforces
this on its own: a branch can be checked out in one worktree at a time, so
`git worktree add … main` fails while the primary checkout holds it.

**The PR is record keeping, not a gate.** There is no branch protection and
nobody is queued to review. The agent that wrote the change merges it —
`gh pr merge --squash --delete-branch`. Don't reach for `gh pr review --approve`
on the way; GitHub refuses to let an account approve its own pull request. What
the PR buys is a page with a diff, a title and a date, for a change that would
otherwise be one more commit landing on `main` at 3am with no context.

**Merging deploys.** `.github/workflows/deploy.yml` fires on every push to
`main` and ships Cloud Run plus both hosting sites. Merge finished work.

### Traps found the hard way

- **A worktree inside the repo ships with the site.** The marketing site's
  Firebase `public` is the repo root, so `dep/` — a worktree sitting there —
  doubles the deploy: `node tools/hosting-deploy.mjs seaworth --dry` lists 28
  files for a 14-file site, the rest a second copy of everything under `/dep/`,
  `oddfox.ai/dep/brief.html` included. It is not live only because the deploy
  that runs is CI's, from a clean checkout with no worktrees in it — a deploy
  from this machine would publish it. Worktrees belong in
  `/Users/barak/oddfox-wt/`; read the dry-run file list before deploying the
  root by hand.
- **"Commit only your own files" is retired.** It was the rule when everyone
  shared one checkout; in your own worktree every dirty file is yours and
  `git add -A` is correct. If you find yourself picking paths out of a mixed
  tree, you are working somewhere you shouldn't be.
- **`node_modules` does not come with the worktree** — 189 MB for
  `OddFoxOffice`, 269 MB for `server`. Install only what you need to build,
  and neither one for a docs or data change.
- **Duplicate dev servers fight over ports.** A `tsx` started without `watch`
  will serve stale code forever — check
  `lsof -nP -iTCP:8787 -sTCP:LISTEN` and take a different `PORT` if it answers.
- **Renaming a file leaves Vite's module graph stale**; the page goes blank and
  the console says it failed to reload. A hard reload or a dev-server restart
  fixes it — the build is fine.
