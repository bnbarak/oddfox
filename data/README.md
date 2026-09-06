# Odd Fox — business context library

Structured, sourced business context: who gets attacked at sea, where, what it
costs, and who actually owns and rents the ships. Everything is plain JSON so it
can be lifted into an application later without rewriting.

```
data/
  index.html            the viewer — one file, no framework, no build step
  lib/oddfox.css        shared style layer, tokens mirror the root index.html
  lib/oddfox.js         shared data + render layer (window.OF)
  json/*.json           the datasets — the source of truth
  json/bundle.js        generated offline fallback, see below
  schema/*.json         JSON Schema for each dataset
```

## Looking at it

```bash
python3 -m http.server -d data 8080
```

Then <http://localhost:8080>. Or use the repo's existing preview config, which
serves the whole repo at <http://localhost:4173/data/>.

Opening `data/index.html` straight off disk also works, because `json/bundle.js`
is loaded as a fallback — browsers block `fetch()` on `file://`.

## Editing the data

The `.json` files are the source of truth. After changing one:

```bash
node tools/build-data-bundle.mjs
```

That regenerates `json/bundle.js` and fails loudly if any file is malformed.
It is the only build step in the library.

## Conventions

| | |
|---|---|
| **Join key** | IMO number for vessels. Never ship name — names change, IMO numbers do not. |
| **IDs** | Lowercase kebab-case, stable across versions. Deprecate, never rename. |
| **Dates** | ISO 8601. Periods as `YYYY`, `YYYY-Qn`, `YYYY-Hn`. |
| **Provenance** | Every quantitative record carries `source_ids` into `sources.json`. |
| **Confidence** | `high` read from the publishing body · `medium` credible secondary outlet · `low` aggregator or unverified — do not quote externally without checking. |

A third rule earned the hard way: **piracy data has a shelf life of months.**
The 2025 annual reports described Somali piracy as contained by naval presence.
Six months later the H1 2026 reports describe a resurgence at rates not seen
since 2011. Version 0.1.0 of this library carried the first reading and was
wrong by the time it was written. Check the date on every record.

Two more rules worth keeping. First, **a number never travels without its counting
body** — IMB, ReCAAP and IMO all publish piracy counts and all three disagree,
because they cover different waters and take reports from different people. IMB
recorded 137 incidents worldwide in 2025; IMO recorded 171 for the same year.
Neither is wrong. Second, **gaps are data**. `operators.json` and
`risk-economics.json` both carry a required, non-empty list of what is missing.
Discovering a gap in a pitch is more expensive than writing it down here.

## The datasets

| File | What it holds |
|---|---|
| `manifest.json` | Registry of the datasets, conventions, roadmap. |
| `geo-incidents.json` | Counts on coordinates, one series per counting body and period. Drives the map. |
| `houthi-timeline.json` | 103 attacks, Nov 2023 – Aug 2026: date, vessel, flag, method, result. |
| `world-land.json` | Natural Earth 110m coastline as SVG paths. Generated asset. |
| `sources.json` | All 37 external sources cited anywhere in the library. |
| `ownership-model.json` | The eight-party stack behind any hull, four charter types, and the cheapest path from a ship sighting to a named buyer. |
| `tactics.json` | Four threat models that share almost nothing, the BMP defence layers, and what each measure does **not** stop. |
| `attack-log.json` | Incident-level entries at UKMTO/ReCAAP granularity, the H1 2026 pattern data, and eight live feeds to pull from. |
| `threat-stats.json` | IMB, ReCAAP and IMO counts through H1 2026, with findings. |
| `incidents.json` | Nine named attacks where the ownership chain is on the record. |
| `chokepoints.json` | Fourteen passages, threat types, and which ones the incident data actually supports. |
| `registries.json` | Fourteen authoritative lists, sorted by whether they answer identity, what-is-happening, or what-it-costs. |
| `flag-states.json` | Where tonnage is registered, and why that tells you little about who to call. |
| `operators.json` | Companies that can sign a contract, plus who is still missing. |
| `risk-economics.json` | War-risk premiums as a percentage of hull value, 0.125% to 10%. |
| `route-economics.json` | The Cape diversion, the price of armed guards, and a 2012 convoy-escort precedent. |

## Using the shared library

`lib/oddfox.js` exposes `window.OF` with no dependencies.

```js
OF.data.loadAll(['manifest', 'sources', 'incidents']).then(function (all) {
  var sunk = OF.data.where('incidents', function (r) { return r.outcome === 'sunk'; });
  OF.ui.mount('#app', OF.ui.table(sunk, [
    { key: 'date',  label: 'Date' },
    { key: 'vessel', label: 'Vessel', render: function (r) { return r.vessel.name; } }
  ]));
});
```

`OF.data` — `load`, `loadAll`, `get`, `records`, `byId`, `where`, `series`,
`breakdown`, `source`, `pointAt`, `pctChange`.

`OF.ui` — `esc`, `chip`, `chips`, `confChip`, `stat`, `bars`, `table`, `cite`,
`section`, `grid`, `callout`, `gap`, `mount`.

`cite(source_ids)` resolves ids through `sources.json` and renders linked
attribution, so citations cannot drift from the register.

## Not deployed

This library is internal. `index.html` carries `noindex,nofollow` and `data/`
is excluded from Firebase Hosting. Check `firebase.json` before deploying if
that ever needs to change.

## Rules

**No interpretation.** Records carry facts, numbers and sources. Analysis and
framing are deliberately absent — add them where they get used, not here.
The `no_interpretation` convention in the manifest is enforced by habit, not
by the build.

**A number never travels without its counting body.** IMB, ReCAAP and IMO all
publish piracy counts and all three disagree, because they cover different
water and take reports from different people. IMB recorded 137 incidents
worldwide in 2025; IMO recorded 171 for the same year. Neither is wrong.

**Gaps are data.** `operators.json` and the economics datasets carry required,
non-empty lists of what is missing.

**Shelf life is months.** The 2025 annual reports describe Somali piracy as
contained. The H1 2026 reports describe a resurgence at rates not seen since
2011. Check the date on every record.

## Charts, maps and flags

`lib/oddfox.js` renders everything inline as SVG — no chart library, no runtime
dependency.

| Helper | What it draws |
|---|---|
| `OF.ui.map(points, {reference})` | World map, equirectangular, circles sized by count. Auto-fits the viewBox to the plotted data and staggers labels to reduce collisions. |
| `OF.ui.multiline(series, {logY})` | Several dated series on one time axis. Used for war-risk premium by area; log scale because the range spans 0.1% to 10%. |
| `OF.ui.line(points)` | Single time series with area fill. |
| `OF.ui.columns(points)` | Vertical bars. |
| `OF.ui.pie(items, {donut})` | Donut or pie with legend and percentages. |
| `OF.ui.bars(rows)` | Horizontal bars. |
| `OF.ui.flag(iso)` | Flag image from flagsapi.com by ISO 3166-1 alpha-2. |
| `OF.ui.tally(items, key)` | Counts by field, sorted — feeds the pies directly. |

Map coordinates are `[lat, lon]` decimal degrees. The projection is a two-line
calculation shared between `tools/build-world-path.py` and `OF.ui.lonlat`, so
there is no projection library to keep in sync.

The land outline regenerates from Natural Earth:

```bash
curl -sLo /tmp/ne110.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
python3 tools/build-world-path.py /tmp/ne110.geojson
```

Flag images are the one external request the page makes. Everything else is
local.
