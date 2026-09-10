/** Pushes data/json/crm/sequences.json to Firestore's crmMeta/sequences, and
    nothing else.

    Separate from migrate-to-firestore on purpose. That script also rewrites
    every account and contact from the JSON files, which would undo the
    addresses Apollo bought and anything else the app has written since — so
    it is not the tool for "I edited the copy in a template". This one touches
    the single document the sending path reads.

    Run with: npm run push:sequences --prefix server */
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SequencesFile } from "../src/schemas.js";
import { crmPath, readJson } from "../src/store.js";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? "maine-507401";

async function main() {
  initializeApp({ projectId: PROJECT_ID });
  const sequences = await readJson(crmPath("sequences.json"), SequencesFile);
  await getFirestore().collection("crmMeta").doc("sequences").set(sequences);
  const rounds = sequences.sequences.reduce((n, s) => n + s.rounds.length, 0);
  console.log(`Pushed ${sequences.sequences.length} tiers, ${rounds} rounds to ${PROJECT_ID}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
