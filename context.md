# Context

Working knowledge that is not obvious from the code. Read this before touching
the CRM, the data files, or a deploy. For routine site tasks (PDF password,
replacing the deck) see [UPDATING.md](UPDATING.md).

Last updated: 2026-09-06.

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
uses: `crmSends`, `crmQuota`, `crmReplies`, `crmTicks`, `crmOutreachMeta`.
There was briefly a Cloud SQL Postgres for this; it was deleted. At fifteen
messages a day the reports are built by reading the documents and grouping in
memory, which is cheaper in every sense than running an instance to `GROUP BY`.

**Resend owns everything Resend already does.** Scheduling is `scheduledAt` on
the send, and the email id it returns *is* the cancel token — that is why
nothing is ever sent immediately, even two minutes out. Opt-outs are Resend's
suppression list, which it adds to automatically on every bounce and complaint
and skips sending to across the whole team; we only push to it when a human
types "unsubscribe" in a reply, because that is the one thing Resend cannot
infer. We keep no second list.

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
  --set-secrets TICK_TOKEN=oddfox-crm-tick-token:latest \
  --update-env-vars GOOGLE_CLOUD_PROJECT=maine-507401
```

Cloud Run in Maine cannot be made public with an `allUsers` IAM binding — an
org policy on permitted domains refuses it. It uses
`--no-invoker-iam-check` instead, which is how the old service was configured
too. Firebase Hosting rewrites need anonymous access to reach the service; the
real access boundary is `server/src/auth.ts`, which checks a Google ID token on
every `/api` route, and `TICK_TOKEN` on `/tasks/tick`.

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

Several agents may edit this repo at once. Things that actually bit:

- Files change under you mid-task. Re-read before editing; do not revert someone
  else's work because it looks unfamiliar.
- Commit **only your own files**. Others have in-flight work in the tree.
- Duplicate dev servers fight over ports. A `tsx` started without `watch` will
  serve stale code forever — check `lsof -nP -iTCP:8787 -sTCP:LISTEN` and prefer
  one `npm run dev` instance.
- Renaming a file leaves Vite's module graph stale; the page goes blank and the
  console says it failed to reload. A hard reload or a dev-server restart fixes
  it — the build is fine.
