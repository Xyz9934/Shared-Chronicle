import { getApp, getApps, initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const publicEnv = (value: string | undefined) => value?.trim() ?? '';
type FirebaseAuthModule = typeof import('firebase/auth');
type InitializeAuthDependencies = NonNullable<Parameters<FirebaseAuthModule['initializeAuth']>[1]>;

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

export const isFirebaseConfigured = Object.entries(firebaseConfig)
  .filter(([key]) => key !== 'storageBucket')
  .every(([, value]) => value.length > 0);

export const syncMode = isFirebaseConfigured
  ? 'Firebase cloud sync'
  : 'Private preview mode';

export let firebaseApp: ReturnType<typeof initializeApp> | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;
export let firebaseInitializationError: Error | null = null;
let firebaseInitialized = false;

export function initializeFirebase(): { auth: Auth | null; db: Firestore | null } {
  if (firebaseInitialized) return { auth, db };
  firebaseInitialized = true;

  if (!isFirebaseConfigured) return { auth, db };

  try {
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const firebaseAuthModule = require('firebase/auth') as FirebaseAuthModule & {
      getReactNativePersistence: (
        storage: typeof AsyncStorage,
      ) => InitializeAuthDependencies['persistence'];
    };
    auth = Platform.OS === 'web'
      ? firebaseAuthModule.getAuth(firebaseApp)
      : firebaseAuthModule.initializeAuth(firebaseApp, {
          persistence: firebaseAuthModule.getReactNativePersistence(AsyncStorage),
        });
    db = getFirestore(firebaseApp);
  } catch (error) {
    firebaseInitializationError = error instanceof Error
      ? error
      : new Error('Firebase initialization failed.');
    console.error('[Firebase] Initialization failed', {
      message: firebaseInitializationError.message,
    });
    firebaseApp = null;
    auth = null;
    db = null;
  }

  return { auth, db };
}

/**
 * Returns an existing user's private-space profile without provisioning users.
 */
export async function ensureUserProfile(
  firebaseUser: FirebaseUser,
): Promise<DocumentData> {
  if (!db) {
    throw new Error('Firebase is not configured.');
  }

  const profile = await getDoc(doc(db, 'users', firebaseUser.uid));
  if (!profile.exists()) {
    throw new Error('No private profile exists for this Firebase account.');
  }

  const profileData = profile.data();
  if (profileData.role !== 'OWNER' && profileData.role !== 'USER') {
    throw new Error('The Firebase profile has an invalid role.');
  }

  return profileData;
}
