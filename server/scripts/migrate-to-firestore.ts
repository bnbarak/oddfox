/** One-off: load data/json/crm/*.json into Firestore. Safe to re-run — it
    overwrites each document with the current file contents (`set`, not
    `create`), so re-running after editing the JSON re-syncs Firestore.
    Run with: npm run migrate --prefix server */
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { AccountRecord, AccountsFile, ContactRecord, ContactsFile, SequencesFile } from "../src/schemas.js";
import { crmPath, readJson } from "../src/store.js";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? "vocal-vigil-497322-k8";

async function main() {
  initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore();

  const accounts = await readJson(crmPath("accounts.json"), AccountsFile);
  const contacts = await readJson(crmPath("contacts.json"), ContactsFile);
  const sequences = await readJson(crmPath("sequences.json"), SequencesFile);

  let batch = db.batch();
  let ops = 0;
  const flushIfFull = async () => {
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };

  for (const record of accounts.records) {
    batch.set(db.collection("crmAccounts").doc(record.id), AccountRecord.parse(record));
    ops++;
    await flushIfFull();
  }
  for (const record of contacts.records) {
    batch.set(db.collection("crmContacts").doc(record.id), ContactRecord.parse(record));
    ops++;
    await flushIfFull();
  }
  batch.set(db.collection("crmMeta").doc("sequences"), sequences);
  ops++;

  await batch.commit();
  console.log(
    `Migrated ${accounts.records.length} accounts, ${contacts.records.length} contacts, and the sequences doc to Firestore.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
