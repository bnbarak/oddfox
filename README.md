# Odd Fox — site

One static page. No framework, no build step.

```
index.html          the entire site (markup, CSS, JS inline)
assets/hero.mp4     1600×696 hero loop, desktop (~1.4 MB)
assets/hero-sm.mp4  992×432 hero loop, <1024px viewports (~390 KB)
assets/poster.jpg   first frame, painted instantly behind the video (~47 KB)
media-src/          uncompressed master footage — not deployed
```

First paint is ~5 KB gzipped HTML + 47 KB poster. The video is only requested
after `load`, and is skipped entirely on Save-Data, 2G, or `prefers-reduced-motion`.

## Things you'll want to change

| What | Where |
|---|---|
| Contact email | `CONTACT_EMAIL` in the script at the bottom of `index.html` |
| Form backend | `FORM_ENDPOINT` — empty means the form composes a mail-client message instead |
| Company name | `Odd Fox` in `<title>`, nav, and footer |

## Replacing the hero footage

Drop the new master in `media-src/`, then:

```bash
ffmpeg -i media-src/NEW.mp4 -vf "scale=1600:-2:flags=lanczos" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart -an assets/hero.mp4
ffmpeg -i media-src/NEW.mp4 -vf "scale=992:-2" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -an assets/hero-sm.mp4
ffmpeg -i media-src/NEW.mp4 -vf "scale=1280:-2:flags=lanczos" -frames:v 1 -q:v 4 assets/poster.jpg
```

The current loop was cut from the master with a 0.6 s cross-dissolve between the
last and first frames, so it repeats without a visible cut.

## Deploy — Firebase Hosting (cheapest on GCP)

Free tier, global CDN, free TLS on a custom domain, no always-on cost. A load
balancer in front of a Cloud Storage bucket does the same job for ~$18/month.

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only hosting --project YOUR_PROJECT_ID
```

`firebase.json` is already set up: long cache on `assets/`, no cache on the HTML.

Watch the free-tier egress if the site gets traffic — 360 MB/day is roughly 250
hero-video loads. On the Blaze plan it's $0.15/GB after that.

## Deploy — Cloud Storage only

```bash
./deploy-gcs.sh gs://your-bucket-name
```

HTTP only on the bucket URL. Custom domain over HTTPS requires the load balancer.

## Local

```bash
firebase emulators:start --only hosting
```

Serves on <http://localhost:4173> with the real routing. A plain file server
(`python3 -m http.server`) gets the clean URLs wrong — `/brief` will 404.

## The password-gated PDF

The "Overview" button on the home page goes to `/brief`, which asks for a
password and then downloads the PDF.

```
media-src/docs/     the PDF masters — not deployed
tools/gate-pdf.mjs  copies a master into assets/d/ under a name derived from the password
assets/d/           the one file that ships; its name is the hash, so the URL is unguessable
brief.html          the gate; hashes what's typed and fetches that name
```

There is no password in the page and no PDF URL in the page. The page works the
filename out from what the visitor types — a wrong password asks the server for a
file that isn't there, and gets a 404. Keep masters in `media-src/docs/`, never in
`assets/`, or the gate is pointless.

It is a marketing gate, not a vault. Whoever has the password can pass it on, and
guesses can be tried against the server with no rate limit, so a common word would
eventually fall to a wordlist. Fine for collateral; not for anything confidential.

## The CRM

The office app at <https://office.seaworth.ai> carries a CRM that writes,
schedules and tracks outreach to the target list. What it is for, what it will
not do, and the rules it sends under are in **[OUTREACH.md](OUTREACH.md)** —
written for a reader who does not want to hear about code.

**Day-to-day instructions — changing the password, replacing the PDF, editing
copy, deploying — are in [UPDATING.md](UPDATING.md).**
