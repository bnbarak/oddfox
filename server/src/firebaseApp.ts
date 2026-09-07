import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// This machine's ambient gcloud/ADC project varies by whatever else is
// running locally, so pin explicitly rather than trust the default.
//
// Cloud Run does NOT set GOOGLE_CLOUD_PROJECT — it only sets K_SERVICE,
// K_REVISION and K_CONFIGURATION — so it has to be passed in at deploy time.
// Leaving it unset does not fail loudly: the service falls through to the
// literal below and quietly talks to a different project's Firestore, which
// surfaces as PERMISSION_DENIED from gRPC with nothing naming the project.
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? "vocal-vigil-497322-k8";

/** Single shared Firestore handle for the whole server — repository and
    auth logging both go through this so there's only one app instance. */
export function db(): Firestore {
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  return getFirestore();
}
