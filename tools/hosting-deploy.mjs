#!/usr/bin/env node
/* Deploy a Firebase Hosting site through the REST API.

   Why this exists: `firebase deploy` is repeatedly OOM-killed on this machine
   (exit 137, no output, about a second in) because the CLI wants more memory
   than is free. This does the same five API calls the CLI does, streaming one
   file at a time, and finishes in a few megabytes.

   Reads the site's config out of firebase.json so the deployed headers,
   cleanUrls and rewrites match what the CLI would have produced.

   Usage:
     node tools/hosting-deploy.mjs <siteId> [--project <id>] [--dry]
*/
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, posix } from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const siteId = args[0];
const project = args[args.indexOf("--project") + 1] ?? "vocal-vigil-497322-k8";
const dry = args.includes("--dry");
if (!siteId || siteId.startsWith("--")) {
  console.error("usage: node tools/hosting-deploy.mjs <siteId> [--project <id>] [--dry]");
  process.exit(2);
}

const root = process.cwd();
const cfgFile = JSON.parse(await readFile(join(root, "firebase.json"), "utf8"));
const site = (cfgFile.hosting ?? []).find((h) => h.site === siteId);
if (!site) throw new Error(`no hosting entry for site "${siteId}" in firebase.json`);

const publicDir = join(root, site.public);
const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const API = "https://firebasehosting.googleapis.com/v1beta1";

const headers = {
  authorization: `Bearer ${token}`,
  "x-goog-user-project": project,
};

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...headers, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

/* --- which files ship -------------------------------------------------- */

/** firebase.json's ignore patterns, enough of glob to cover what this repo
    actually uses: a leading `**​/`, a trailing `/**`, and `*` inside a
    segment. Anything more exotic should be spelled out literally. */
function matches(pattern, path) {
  const rx = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "(?:.*/)?")
    .replace(/\/\*\*/g, "(?:/.*)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${rx}$`).test(path);
}

const ignore = site.ignore ?? [];
const ignored = (rel) => ignore.some((p) => matches(p, rel) || matches(p, posix.basename(rel)));

async function walk(dir, out = []) {
  for (const name of await readdir(dir)) {
    const abs = join(dir, name);
    const rel = relative(publicDir, abs).split(/[\\/]/).join("/");
    if (ignored(rel)) continue;
    const s = await stat(abs);
    if (s.isDirectory()) await walk(abs, out);
    else out.push({ abs, url: `/${rel}` });
  }
  return out;
}

const files = await walk(publicDir);
files.sort((a, b) => a.url.localeCompare(b.url));

// Hash the *gzipped* bytes — that is what populateFiles compares against.
const prepared = files.map((f) => ({ ...f, gz: null, hash: null }));
for (const f of prepared) {
  f.gz = gzipSync(await readFile(f.abs), { level: 9 });
  f.hash = createHash("sha256").update(f.gz).digest("hex");
}

const total = prepared.reduce((n, f) => n + f.gz.length, 0);
console.log(`site ${siteId} (project ${project})`);
console.log(`  ${prepared.length} files, ${(total / 1024).toFixed(0)} KB gzipped`);
for (const f of prepared) console.log(`    ${f.url}`);
if (dry) { console.log("  dry run — nothing uploaded"); process.exit(0); }

/* --- the five calls ---------------------------------------------------- */

/* The version carries the routing config, so headers, cleanUrls and rewrites
   have to be passed here or the deployed site quietly loses them. The REST
   shape is not firebase.json's shape: the CLI's `source` is the API's `glob`,
   and a header block's `headers` is a map on the wire but a list of
   {key, value} pairs in the file. */
const asGlob = (rule) => {
  const { source, regex, ...rest } = rule;
  return regex ? { regex, ...rest } : { glob: source, ...rest };
};

const config = {};
for (const k of ["cleanUrls", "appAssociation", "i18n"]) {
  if (site[k] !== undefined) config[k] = site[k];
}
// firebase.json says trailingSlash: true|false; the API wants an enum.
if (site.trailingSlash !== undefined) {
  config.trailingSlashBehavior = site.trailingSlash ? "ADD" : "REMOVE";
}
if (site.headers) {
  config.headers = site.headers.map((h) => {
    const { headers, ...rest } = asGlob(h);
    return { ...rest, headers: Object.fromEntries(headers.map((x) => [x.key, x.value])) };
  });
}
if (site.redirects) config.redirects = site.redirects.map(asGlob);
if (site.rewrites) config.rewrites = site.rewrites.map((r) => {
  const { destination, ...rest } = asGlob(r);
  return destination === undefined ? rest : { ...rest, path: destination };
});

const version = await api("POST", `/sites/${siteId}/versions`, { config });
console.log(`  version ${version.name}`);

const pop = await api("POST", `/${version.name}:populateFiles`, {
  files: Object.fromEntries(prepared.map((f) => [f.url, f.hash])),
});
const need = new Set(pop.uploadRequiredHashes ?? []);
console.log(`  ${need.size} of ${prepared.length} need uploading`);

let n = 0;
for (const f of prepared) {
  if (!need.has(f.hash)) continue;
  const res = await fetch(`${pop.uploadUrl}/${f.hash}`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/octet-stream" },
    body: f.gz,
  });
  if (!res.ok) throw new Error(`upload ${f.url} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
  n++;
  process.stdout.write(".");
}
if (n) console.log("");

await api("PATCH", `/${version.name}?update_mask=status`, { status: "FINALIZED" });
const release = await api("POST", `/sites/${siteId}/releases?versionName=${version.name}`);
console.log(`  released ${release.name}`);
console.log(`  live: https://${siteId}.web.app/`);
