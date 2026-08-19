import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
} from 'firebase/auth';
import {
  doc,
  getFirestore,
  runTransaction,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

/**
 * Firebase stays behind this boundary so the UI never needs to know where
 * content is stored. Add the EXPO_PUBLIC_FIREBASE_* values to enable the
 * production adapter without changing screen code.
 */
export const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export const syncMode = isFirebaseConfigured ? 'Firebase cloud sync' : 'Private preview mode';

export const firebaseApp = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

let firebaseAuth: Auth | null = null;
if (firebaseApp) {
  // Firebase 12 selects its React Native Auth implementation from the
  // `firebase/auth` export itself. The former `firebase/auth/react-native`
  // entry point no longer exists and prevents Metro from loading the app.
  firebaseAuth = getAuth(firebaseApp);
}

export const auth = firebaseAuth;
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;

/**
 * Returns a user's private-space profile, creating a minimal USER profile for
 * a newly authenticated Firebase account. The transaction makes the
 * existence check and creation atomic, and deliberately leaves existing
 * profiles (including OWNER profiles) untouched.
 */
export async function ensureUserProfile(firebaseUser: FirebaseUser): Promise<DocumentData> {
  if (!db) throw new Error('Firebase is not configured.');

  const profileRef = doc(db, 'users', firebaseUser.uid);
  return runTransaction(db, async (transaction) => {
    const profile = await transaction.get(profileRef);
    if (profile.exists()) return profile.data();

    transaction.set(profileRef, {
      role: 'USER',
      ...(firebaseUser.email ? { email: firebaseUser.email } : {}),
    });

    return {
      role: 'USER',
      ...(firebaseUser.email ? { email: firebaseUser.email } : {}),
    };
  });
}
