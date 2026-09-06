# Context

Working knowledge that is not obvious from the code. Read this before touching
the CRM, the data files, or a deploy. For routine site tasks (PDF password,
replacing the deck) see [UPDATING.md](UPDATING.md).

Last updated: 2026-09-06.

---

## The shape of the thing

Three pieces, one Firebase project (`vocal-vigil-497322-k8`, alias `biofenix`):

| Piece | Lives at | Source | Notes |
|---|---|---|---|
| Marketing site | <https://oddfox.ai> | repo root (`index.html`, `assets/`) | no build step |
| Office app | <https://oddfox-office.web.app> | `OddFoxOffice/` (Vite + React 19) | `npm run build` first |
| CRM API | `/api/**` on the office site | `server/` (Express + zod) | Cloud Run `oddfox-crm-server`, `us-central1` |

The office app is a data library of panels plus slide decks. Panels live in
`OddFoxOffice/src/library/panels/`, registered in `library/Library.tsx` as a
two-level nav: `GROUPS` (top row) → `TABS` filtered by group (second row).

**The `/api/**` rewrite is on the office site only.** Hitting
`https://oddfox.ai/api/...` will always 404 — that is the wrong site, not a
broken API. Test against `oddfox-office.web.app`.

---

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

## Deploying

Firebase CLI and gcloud authenticate **separately**. The Firebase CLI has its
own token and works when gcloud's has expired.

```bash
npm run build --prefix OddFoxOffice                  # office app must be built first
firebase deploy --only hosting:oddfox-office         # office app
firebase deploy --only hosting:vocal-vigil-497322-k8 # marketing site
firebase deploy --only hosting                       # both
```

The Cloud Run API deploys from `server/Dockerfile`, and Firestore seeding
(`npm run migrate --prefix server`) uses **gcloud ADC** — both need:

```bash
gcloud auth login
gcloud auth application-default login
```

Neither can run from a non-interactive agent session; they need a browser.

To confirm what is actually live, compare the deployed bundle hash to the local
one rather than trusting a deploy log:

```bash
curl -s https://oddfox-office.web.app/ | grep -o '/assets/main-[^"]*\.js'
ls OddFoxOffice/dist/assets/main-*.js
```

Content-hashed filenames mean identical hashes prove identical content.

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
