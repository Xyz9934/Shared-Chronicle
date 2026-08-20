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

const publicEnv = (value: string | undefined) => value?.trim() ?? '';

/**
 * Firebase stays behind this boundary so the UI never needs to know where
 * content is stored. Add the EXPO_PUBLIC_FIREBASE_* values to enable the
 * production adapter without changing screen code.
 */
export const firebaseConfig: FirebaseConfig = {
  apiKey: publicEnv(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: publicEnv(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: publicEnv(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: publicEnv(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: publicEnv(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: publicEnv(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every((value) => value.length > 0);

export const syncMode = isFirebaseConfigured
  ? 'Firebase cloud sync'
  : 'Private preview mode';

export const firebaseApp = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

let firebaseAuth: Auth | null = null;

if (firebaseApp) {
  // Firebase 12 selects its React Native Auth implementation from the
  // `firebase/auth` export itself. The former React Native subpath imports
  // are not used because they are unavailable in Firebase 12.17.1.
  firebaseAuth = getAuth(firebaseApp);
}

export const auth = firebaseAuth;

export const db: Firestore | null = firebaseApp
  ? getFirestore(firebaseApp)
  : null;

export const storage: FirebaseStorage | null = firebaseApp
  ? getStorage(firebaseApp)
  : null;

/**
 * Returns a user's private-space profile, creating a minimal USER profile
 * for a newly authenticated Firebase account.
 *
 * The transaction makes the existence check and creation atomic, and
 * deliberately leaves existing profiles (including OWNER profiles) untouched.
 */
export async function ensureUserProfile(
  firebaseUser: FirebaseUser,
): Promise<DocumentData> {
  if (!db) {
    throw new Error('Firebase is not configured.');
  }

  const profileRef = doc(db, 'users', firebaseUser.uid);

  return runTransaction(db, async (transaction) => {
    const profile = await transaction.get(profileRef);

    if (profile.exists()) {
      return profile.data();
    }

    const profileData = {
      role: 'USER',
      ...(firebaseUser.email ? { email: firebaseUser.email } : {}),
    };

    transaction.set(profileRef, profileData);

    return profileData;
  });
}
