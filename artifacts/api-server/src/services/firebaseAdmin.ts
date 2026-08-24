import { applicationDefault, cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";

function getCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson) as {
      projectId?: string;
      project_id?: string;
      clientEmail?: string;
      client_email?: string;
      privateKey?: string;
      private_key?: string;
    };

    return cert({
      projectId: serviceAccount.projectId ?? serviceAccount.project_id,
      clientEmail: serviceAccount.clientEmail ?? serviceAccount.client_email,
      privateKey: (serviceAccount.privateKey ?? serviceAccount.private_key ?? "").replace(/\\n/g, "\n"),
    });
  }

  return applicationDefault();
}

export function getFirebaseAdminApp(): App {
  if (getApps().length > 0) return getApp();

  return initializeApp({
    credential: getCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID?.trim() || undefined,
  });
}
