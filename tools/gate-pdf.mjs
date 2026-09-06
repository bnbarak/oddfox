#!/usr/bin/env node
// Put a PDF behind the password gate at /brief.html.
//
//   node tools/gate-pdf.mjs "assets/Odd Fox — System Overview.pdf"
//
// It asks for a password and copies the PDF to assets/d/<hash>.pdf, where
// <hash> is derived from the password. That is the whole trick: the password
// itself is never written to the site, and brief.html doesn't contain the
// PDF's URL — it works the URL out from what the visitor types. A wrong
// password points at a file that isn't there.
//
// Passwords are trimmed and lowercased so "Anchor 24" and "anchor24 " both
// work — brief.html normalises the same way.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { createInterface } from "node:readline";

const DIR = "assets/d";

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
let muted = false;
rl._writeToOutput = (s) => { if (!muted) rl.output.write(s); };
const lines = rl[Symbol.asyncIterator]();

async function ask(query) {
  if (process.stdin.isTTY) {
    return new Promise((resolve) => {
      rl.question(query, (answer) => { muted = false; process.stdout.write("\n"); resolve(answer); });
      muted = true;
    });
  }
  const { value, done } = await lines.next();
  if (done) { console.error("\nNot enough input."); process.exit(1); }
  return value;
}

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const slot = (s) => createHash("sha256").update(norm(s), "utf8").digest("hex").slice(0, 32);

const input = process.argv[2];
if (!input) {
  console.error('usage: node tools/gate-pdf.mjs "assets/Your File.pdf"');
  process.exit(1);
}

const pdf = readFileSync(input);
if (pdf.subarray(0, 4).toString("latin1") !== "%PDF") {
  console.error(`${input} does not look like a PDF.`);
  process.exit(1);
}

const password = await ask("Password to hand out: ");
rl.close();

if (norm(password).length < 4) {
  console.error("Too short — use something you'd be happy to put in an email.");
  process.exit(1);
}

mkdirSync(DIR, { recursive: true });

// One gated file at a time: clear the old slot so an old password stops working.
let replaced = 0;
for (const f of readdirSync(DIR)) {
  if (f.endsWith(".pdf")) { rmSync(join(DIR, f)); replaced++; }
}

const name = slot(password) + ".pdf";
writeFileSync(join(DIR, name), pdf);

console.log(`\n  ${(pdf.length / 1048576).toFixed(2)} MB  ->  ${DIR}/${name}`);
if (replaced) console.log(`  Removed ${replaced} older file — the previous password no longer works.`);
console.log(`  The password is not stored anywhere. Write it down somewhere you'll find it.`);
console.log(`\n  Then: firebase deploy --only hosting\n`);
