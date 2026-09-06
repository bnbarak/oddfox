import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// This machine's ambient gcloud/ADC project varies by whatever else is
// running locally, so pin explicitly rather than trust the default. Cloud
// Run sets GOOGLE_CLOUD_PROJECT to whatever project the service actually
// runs in, which always wins.
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? "vocal-vigil-497322-k8";

/** Single shared Firestore handle for the whole server — repository and
    auth logging both go through this so there's only one app instance. */
export function db(): Firestore {
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  return getFirestore();
}
