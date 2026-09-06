# Updating the site

Everything here runs from the project root.

```bash
cd ~/oddfox
```

There are two sites in one Firebase project:

| Site | Lives at | Source | Build step |
|---|---|---|---|
| Marketing site | <https://oddfox.ai> | repo root (`index.html`, `brief.html`, `assets/`) | none |
| Office app | <https://office.oddfox.ai> | `OddFoxOffice/` | yes — see below |

`firebase deploy --only hosting` now deploys **both**. To deploy just one:

```bash
firebase deploy --only hosting:vocal-vigil-497322-k8   # marketing site
firebase deploy --only hosting:oddfox-office           # office app
```

---

## Change the PDF password

Current password: **corsair**

```bash
node tools/gate-pdf.mjs "media-src/docs/Odd Fox — System Overview.pdf"
firebase deploy --only hosting
```

It asks for the new password once (nothing shows as you type), renames the served
file, and deletes the old one — so **the previous password stops working the
moment you deploy**. Anyone still holding it gets "That password doesn't open it."

Write the new password down somewhere. It isn't stored in this repo, on the
server, or anywhere I can recover it. If you forget it, just set a new one.

Casing and extra spaces are forgiven: `Corsair`, `CORSAIR`, ` corsair ` all work.
Spaces themselves still count — `odd fox` and `oddfox` are different passwords.

---

## Replace the PDF

Overwrite the master, keeping the same filename, then re-run the same command:

```bash
cp ~/Desktop/new-version.pdf "media-src/docs/Odd Fox — System Overview.pdf"
node tools/gate-pdf.mjs "media-src/docs/Odd Fox — System Overview.pdf"
firebase deploy --only hosting
```

You'll be asked for the password again. Type the **same one** to keep it
unchanged, or a new one to rotate it at the same time.

> **Never put the PDF in `assets/`.** Everything in `assets/` is public on the
> internet, so a copy there lets people skip the password entirely. Masters live
> in `media-src/docs/`, which is excluded from deploys.

If you want the download to arrive under a different filename, edit
`DOWNLOAD_NAME` near the bottom of `brief.html`.

---

## Change website text

| What | Where |
|---|---|
| Headline, sub-line, section copy | `index.html` — it's all one file |
| Contact email | `CONTACT_EMAIL` in the script at the bottom of `index.html` |
| Waitlist form backend | `FORM_ENDPOINT`, same place |
| Password page heading and blurb | `<h1>` and the `.sub` paragraph in `brief.html` |
| Footer disclaimer | bottom of `index.html` |

Then:

```bash
firebase deploy --only hosting
```

---

## Preview before deploying

```bash
firebase emulators:start --only hosting
```

Opens <http://localhost:4173>. Use this rather than opening the files directly —
it's the only way to see the real URLs (`/brief` with no `.html`), which a plain
file server gets wrong.

Stop it with Ctrl-C.

---

## Deploy

```bash
firebase deploy --only hosting
```

Goes to the `vocal-vigil-497322-k8` project, which serves **oddfox.ai**. The
project is pinned in `.firebaserc`, so you don't need to pass it.

Live in about a minute. To check it worked:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://oddfox.ai/brief
```

`200` means the gate is up.

---

## How the gate works, in one paragraph

The PDF sits at `assets/d/<hash>.pdf`, where the filename is derived from the
password. `brief.html` hashes whatever the visitor types and asks the server for
that filename — a wrong password asks for a file that isn't there and gets a 404.
So the page contains no password and no link to the PDF; viewing source gives an
attacker neither.

It is a marketing gate, not a vault. Two honest limits:

- Whoever has the password can pass it on, and once someone has downloaded the
  file they can share the file itself.
- Guesses can be tried straight against the server with no rate limit, so a
  common dictionary word would fall to an automated wordlist eventually. Fine for
  collateral you're happy to have circulate; not right for anything confidential.
  For something you'd mind leaking, use two unrelated words.

---

## Deploy the office app

It is a Vite app, so unlike the marketing site it **must be built first** —
`firebase deploy` only uploads `OddFoxOffice/dist`, it never runs the build.
Skipping the build silently redeploys the previous version.

```bash
cd ~/oddfox/OddFoxOffice && npm run build
cd ~/oddfox && firebase deploy --only hosting:oddfox-office
```

The app uses clean URLs (`/library/overview`), so `firebase.json` rewrites every
unmatched path to `index.html`. See `OddFoxOffice/ROUTING.md` — without that
rewrite, refreshing a deep link returns 404.

Only `/assets/**` is cached long-term (Vite puts a content hash in those
filenames). Everything else revalidates, so a deploy is visible immediately
rather than up to an hour later.

The whole app is served `X-Robots-Tag: noindex, nofollow` — it is an internal
tool and should not turn up in search results. Remove that header from the
`oddfox-office` block in `firebase.json` if you ever want it indexed.
