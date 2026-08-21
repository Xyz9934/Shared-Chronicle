const admin = require('firebase-admin');
const requiredEnv = (name) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is not configured.`); return value; };
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) { admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) }); } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) { admin.initializeApp(); } else { throw new Error('Set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS.'); }
async function main() {
  const profiles = [{ uid: requiredEnv('TOMMY_UID'), role: 'OWNER' }, { uid: requiredEnv('JERRY_UID'), role: 'USER' }];
  if (profiles[0].uid === profiles[1].uid) throw new Error('TOMMY_UID and JERRY_UID must be different.');
  const db = admin.firestore();
  let created = 0; let verified = 0;
  for (const { uid, role } of profiles) {
    const reference = db.collection('users').doc(uid); const snapshot = await reference.get();
    if (!snapshot.exists) { await reference.create({ role }); created += 1; continue; }
    if (snapshot.get('role') !== role) throw new Error('An existing Firebase profile has an unexpected role.');
    verified += 1;
  }
  console.log(`Firebase profiles complete: ${created} created, ${verified} verified.`);
}
main().catch((error) => { console.error(`Firebase profile initialization failed: ${error instanceof Error ? error.message : 'unknown error'}`); process.exitCode = 1; });
