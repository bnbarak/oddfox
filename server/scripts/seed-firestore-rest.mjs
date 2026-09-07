#!/usr/bin/env node
/* Seeds crmAccounts, crmContacts and crmMeta/sequences into a project's
   Firestore from data/json/crm/*.json.

   This is the same job as migrate-to-firestore.ts, but over the REST API with
   a gcloud access token instead of firebase-admin with Application Default
   Credentials. That matters because ADC needs a browser to refresh and a
   headless session cannot get one, whereas `gcloud auth print-access-token`
   works from whatever gcloud is already logged in as.

   Like the admin-SDK version it writes whole documents, so it OVERWRITES
   pipeline state (status, owner, last_touch, sequence, notes) with whatever
   the JSON says. Check nobody is mid-campaign before running it.

   Usage:
     node scripts/seed-firestore-rest.mjs <projectId> [--dry]
*/
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const project = process.argv[2];
const dry = process.argv.includes("--dry");
if (!project) {
  console.error("usage: node scripts/seed-firestore-rest.mjs <projectId> [--dry]");
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const crmDir = join(here, "..", "..", "data", "json", "crm");

const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const BASE = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;

/** JSON value -> Firestore REST typed value. Integers must go out as
    integerValue or they come back as doubles and the zod schemas reject
    them (tier, fleet and priority are all declared as ints). */
function val(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  return { mapValue: { fields: fields(v) } };
}

const fields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, val(v)]));

async function put(path, doc) {
  if (dry) return;
  const res = await fetch(`${BASE}/${path}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-goog-user-project": project,
    },
    body: JSON.stringify({ fields: fields(doc) }),
  });
  if (!res.ok) throw new Error(`PATCH ${path} -> ${res.status} ${await res.text()}`);
}

const read = async (name) => JSON.parse(await readFile(join(crmDir, name), "utf8"));

// Firestore's write quota is generous but a hundred-odd parallel PATCHes is
// still a needless spike; ten at a time finishes in a couple of seconds.
async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
    process.stdout.write(".");
  }
}

const accounts = await read("accounts.json");
const contacts = await read("contacts.json");
const sequences = await read("sequences.json");

console.log(`seeding ${project}${dry ? " (dry run)" : ""}`);
process.stdout.write(`  crmAccounts (${accounts.records.length}) `);
await inBatches(accounts.records, 10, (r) => put(`crmAccounts/${r.id}`, r));
console.log(" done");

process.stdout.write(`  crmContacts (${contacts.records.length}) `);
await inBatches(contacts.records, 10, (r) => put(`crmContacts/${r.id}`, r));
console.log(" done");

process.stdout.write("  crmMeta/sequences ");
await put("crmMeta/sequences", sequences);
console.log("done");
