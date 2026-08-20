import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, db, ensureUserProfile, isFirebaseConfigured, storage } from '@/services/firebase';

const authApiBaseUrl = (process.env.EXPO_PUBLIC_AUTH_API_URL ?? '').trim().replace(/\/+$/, '');

export function getAuthApiUrl(): string | null {
  return authApiBaseUrl ? `${authApiBaseUrl}/auth/login` : null;
}

export type CloudRole = 'OWNER' | 'USER';

export type CloudUser = {
  id: string;
  name: string;
  email: string;
  role: CloudRole;
  initials: string;
  photoUrl?: string;
};

export type CloudSettings = {
  id: string;
  ownerName: string;
  partnerName: string;
  greeting: string;
  themePrimary: string;
  homeTitle: string;
  chatTitle: string;
  memoriesTitle: string;
  lettersTitle: string;
  musicTitle: string;
  importantDates: string[];
  secretMessage: string;
  finalMessage: string;
};

export type CloudMessage = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  readBy: string[];
};

export type CloudMemory = {
  id: string;
  title: string;
  description: string;
  date: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  photoUrl?: string;
};

export type CloudPhoto = {
  id: string;
  url: string;
  caption: string;
  date: string;
  uploadedBy: string;
  createdAt: string;
};

export type CloudTimelineEntry = {
  id: string;
  title: string;
  description: string;
  date: string;
  creatorId: string;
  creatorName: string;
  photoUrl?: string;
};

export type CloudLetter = {
  id: string;
  title: string;
  message: string;
  date: string;
  authorId: string;
  authorName: string;
  photoUrl?: string;
  openedBy: string[];
};

export type CloudSong = {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl?: string;
  uploadedBy: string;
  createdAt: string;
};

type CloudContextValue = {
  currentUser: CloudUser | null;
  settings: CloudSettings | null;
  messages: CloudMessage[];
  memories: CloudMemory[];
  photos: CloudPhoto[];
  timeline: CloudTimelineEntry[];
  letters: CloudLetter[];
  songs: CloudSong[];
  isLoading: boolean;
  isFirebaseConfigured: boolean;
  error: string;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  markMessageRead: (messageId: string) => Promise<void>;
  addMemory: (input: { title: string; description: string; date: string; photoUri?: string }, onProgress?: (value: number) => void) => Promise<void>;
  updateMemory: (id: string, input: Partial<Pick<CloudMemory, 'title' | 'description' | 'date'>>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  addPhoto: (input: { uri: string; caption: string; date: string }, onProgress?: (value: number) => void) => Promise<void>;
  addTimeline: (input: { title: string; description: string; date: string; photoUri?: string }, onProgress?: (value: number) => void) => Promise<void>;
  updateTimeline: (id: string, input: Partial<Pick<CloudTimelineEntry, 'title' | 'description' | 'date'>>) => Promise<void>;
  deleteTimeline: (id: string) => Promise<void>;
  addLetter: (input: { title: string; message: string; date: string; photoUri?: string }, onProgress?: (value: number) => void) => Promise<void>;
  markLetterOpened: (id: string) => Promise<void>;
  addSong: (input: { title: string; artist: string; audioUri: string; coverUri?: string }, onProgress?: (value: number) => void) => Promise<void>;
  updateSettings: (input: Partial<Omit<CloudSettings, 'id'>>) => Promise<void>;
  updateProfile: (input: Partial<Pick<CloudUser, 'name' | 'photoUrl'>>) => Promise<void>;
  uploadAsset: (uri: string, path: string, onProgress?: (value: number) => void) => Promise<string>;
};

const CloudContext = createContext<CloudContextValue | null>(null);

const toIso = (value: unknown) => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString();
  }
  return typeof value === 'string' ? value : new Date().toISOString();
};

const asStringArray = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const userFromSnapshot = (firebaseUser: FirebaseUser, data: DocumentData): CloudUser | null => {
  if (data.role !== 'OWNER' && data.role !== 'USER') return null;
  const name = typeof data.name === 'string' && data.name.trim() ? data.name : firebaseUser.displayName ?? 'Private user';
  return {
    id: firebaseUser.uid,
    name,
    email: firebaseUser.email ?? '',
    role: data.role,
    initials: name.slice(0, 1).toUpperCase(),
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
  };
};

const defaultSettings: CloudSettings = {
  id: 'space',
  ownerName: '',
  partnerName: '',
  greeting: 'Welcome back to your little world.',
  themePrimary: '#c75b7c',
  homeTitle: 'Home',
  chatTitle: 'Just between us',
  memoriesTitle: 'Memories',
  lettersTitle: 'Letters',
  musicTitle: 'Music',
  importantDates: [],
  secretMessage: '',
  finalMessage: '',
};

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CloudUser | null>(null);
  const [settings, setSettings] = useState<CloudSettings | null>(null);
  const [messages, setMessages] = useState<CloudMessage[]>([]);
  const [memories, setMemories] = useState<CloudMemory[]>([]);
  const [photos, setPhotos] = useState<CloudPhoto[]>([]);
  const [timeline, setTimeline] = useState<CloudTimelineEntry[]>([]);
  const [letters, setLetters] = useState<CloudLetter[]>([]);
  const [songs, setSongs] = useState<CloudSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth || !db) {
      setError('Firebase configuration is missing. Add the requested environment values and restart the app.');
      setIsLoading(false);
      return undefined;
    }
    const currentAuth = auth;
    return onAuthStateChanged(currentAuth, async (firebaseUser) => {
      setError('');
      if (!firebaseUser) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }
      try {
        // Provision a missing profile before verifying its role. The shared
        // helper never mutates an existing USER or OWNER document.
        const profile = await ensureUserProfile(firebaseUser);
        const nextUser = userFromSnapshot(firebaseUser, profile);
        if (!nextUser) {
          await signOut(currentAuth);
          setCurrentUser(null);
          setError('This account is not one of the two authorized people.');
        } else {
          setCurrentUser(nextUser);
        }
      } catch {
        setCurrentUser(null);
        setError('We could not verify this private account. Check the Firebase users collection.');
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!currentUser || !db) {
      setSettings(null);
      setMessages([]);
      setMemories([]);
      setPhotos([]);
      setTimeline([]);
      setLetters([]);
      setSongs([]);
      return undefined;
    }
    const unsubscribers = [
      onSnapshot(doc(db, 'settings', 'space'), (snapshot) => {
        setSettings(snapshot.exists() ? ({ ...defaultSettings, id: snapshot.id, ...snapshot.data() } as CloudSettings) : defaultSettings);
      }, () => setError('Unable to load shared customization settings.')),
      onSnapshot(query(collection(db, 'messages'), orderBy('createdAt', 'asc')), (snapshot) => {
        setMessages(snapshot.docs.map((item) => {
          const data = item.data();
          return { id: item.id, text: data.text ?? '', senderId: data.senderId ?? '', senderName: data.senderName ?? '', createdAt: toIso(data.createdAt), readBy: asStringArray(data.readBy) };
        }));
      }, () => setError('Unable to sync private chat right now.')),
      onSnapshot(query(collection(db, 'memories'), orderBy('date', 'desc')), (snapshot) => {
        setMemories(snapshot.docs.map((item) => {
          const data = item.data();
          return { id: item.id, title: data.title ?? '', description: data.description ?? '', date: data.date ?? '', creatorId: data.creatorId ?? '', creatorName: data.creatorName ?? '', createdAt: toIso(data.createdAt), photoUrl: data.photoUrl };
        }));
      }, () => setError('Unable to sync memories right now.')),
      onSnapshot(query(collection(db, 'photos'), orderBy('createdAt', 'desc')), (snapshot) => {
        setPhotos(snapshot.docs.map((item) => {
          const data = item.data();
          return { id: item.id, url: data.url ?? '', caption: data.caption ?? '', date: data.date ?? '', uploadedBy: data.uploadedBy ?? '', createdAt: toIso(data.createdAt) };
        }));
      }, () => setError('Unable to sync photos right now.')),
      onSnapshot(query(collection(db, 'timeline'), orderBy('date', 'desc')), (snapshot) => {
        setTimeline(snapshot.docs.map((item) => {
          const data = item.data();
          return { id: item.id, title: data.title ?? '', description: data.description ?? '', date: data.date ?? '', creatorId: data.creatorId ?? '', creatorName: data.creatorName ?? '', photoUrl: data.photoUrl };
        }));
      }, () => setError('Unable to sync the timeline right now.')),
      onSnapshot(query(collection(db, 'letters'), orderBy('date', 'desc')), (snapshot) => {
        setLetters(snapshot.docs.map((item) => {
          const data = item.data();
          return { id: item.id, title: data.title ?? '', message: data.message ?? '', date: data.date ?? '', authorId: data.authorId ?? '', authorName: data.authorName ?? '', photoUrl: data.photoUrl, openedBy: asStringArray(data.openedBy) };
        }));
      }, () => setError('Unable to sync private letters right now.')),
      onSnapshot(query(collection(db, 'songs'), orderBy('createdAt', 'desc')), (snapshot) => {
        setSongs(snapshot.docs.map((item) => {
          const data = item.data();
          return { id: item.id, title: data.title ?? '', artist: data.artist ?? '', audioUrl: data.audioUrl ?? '', coverUrl: data.coverUrl, uploadedBy: data.uploadedBy ?? '', createdAt: toIso(data.createdAt) };
        }));
      }, () => setError('Unable to sync the music shelf right now.')),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [currentUser]);

  const requireCloud = () => {
    if (!currentUser || !db || !storage) throw new Error('A verified Firebase session is required.');
    return { user: currentUser, firestore: db, files: storage };
  };

  const login = async (username: string, password: string) => {
    if (!auth) {
      setError('Firebase is not configured for this app.');
      return false;
    }
    const authApiUrl = getAuthApiUrl();
    if (!authApiUrl) {
      setError('Authentication service is not configured for this app.');
      return false;
    }

    let res: Response;
    try {
      // Exchange username/password for a Firebase custom token from the server.
      res = await fetch(authApiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
    } catch {
      setError('Unable to connect to the authentication service.');
      return false;
    }

    if (res.status === 401) {
      setError('Incorrect username or password, or the account is not authorized.');
      return false;
    }
    if (res.status >= 500) {
      setError('The authentication service is not configured correctly.');
      return false;
    }
    if (!res.ok) {
      setError('The authentication service rejected the login request.');
      return false;
    }

    try {
      const data = await res.json();
      if (!data?.token) {
        setError('The authentication service returned an invalid response.');
        return false;
      }
      await signInWithCustomToken(auth, data.token);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch {
      setError('Authentication could not be completed.');
      return false;
    }
  };

  const logout = async () => {
    if (auth) await signOut(auth);
  };

  const uploadAsset = async (uri: string, path: string, onProgress?: (value: number) => void) => {
    const { files } = requireCloud();
    const response = await fetch(uri);
    const blob = await response.blob();
    const task = uploadBytesResumable(ref(files, path), blob);
    return await new Promise<string>((resolve, reject) => {
      task.on('state_changed', (snapshot) => {
        onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
      }, reject, async () => {
        resolve(await getDownloadURL(task.snapshot.ref));
      });
    });
  };

  const sendMessage = async (text: string) => {
    const { user, firestore } = requireCloud();
    if (!text.trim()) return;
    await addDoc(collection(firestore, 'messages'), {
      text: text.trim(),
      senderId: user.id,
      senderName: user.name,
      createdAt: serverTimestamp(),
      readBy: [user.id],
    });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const markMessageRead = async (messageId: string) => {
    const { user, firestore } = requireCloud();
    await updateDoc(doc(firestore, 'messages', messageId), { readBy: Array.from(new Set([...(messages.find((item) => item.id === messageId)?.readBy ?? []), user.id])) });
  };

  const addMemory = async (input: { title: string; description: string; date: string; photoUri?: string }, onProgress?: (value: number) => void) => {
    const { user, firestore } = requireCloud();
    const photoUrl = input.photoUri ? await uploadAsset(input.photoUri, `memories/${user.id}/${Date.now()}`, onProgress) : '';
    await addDoc(collection(firestore, 'memories'), { title: input.title.trim(), description: input.description.trim(), date: input.date, creatorId: user.id, creatorName: user.name, createdAt: serverTimestamp(), ...(photoUrl ? { photoUrl } : {}) });
  };

  const updateMemory = async (id: string, input: Partial<Pick<CloudMemory, 'title' | 'description' | 'date'>>) => {
    const { firestore } = requireCloud();
    await updateDoc(doc(firestore, 'memories', id), input);
  };

  const deleteMemory = async (id: string) => {
    const { firestore } = requireCloud();
    await deleteDoc(doc(firestore, 'memories', id));
  };

  const addPhoto = async (input: { uri: string; caption: string; date: string }, onProgress?: (value: number) => void) => {
    const { user, firestore } = requireCloud();
    const url = await uploadAsset(input.uri, `photos/${user.id}/${Date.now()}`, onProgress);
    await addDoc(collection(firestore, 'photos'), { url, caption: input.caption.trim(), date: input.date, uploadedBy: user.name, createdAt: serverTimestamp() });
  };

  const addTimeline = async (input: { title: string; description: string; date: string; photoUri?: string }, onProgress?: (value: number) => void) => {
    const { user, firestore } = requireCloud();
    const photoUrl = input.photoUri ? await uploadAsset(input.photoUri, `timeline/${user.id}/${Date.now()}`, onProgress) : '';
    await addDoc(collection(firestore, 'timeline'), { title: input.title.trim(), description: input.description.trim(), date: input.date, creatorId: user.id, creatorName: user.name, ...(photoUrl ? { photoUrl } : {}) });
  };

  const deleteTimeline = async (id: string) => {
    const { firestore } = requireCloud();
    await deleteDoc(doc(firestore, 'timeline', id));
  };

  const updateTimeline = async (id: string, input: Partial<Pick<CloudTimelineEntry, 'title' | 'description' | 'date'>>) => {
    const { firestore } = requireCloud();
    await updateDoc(doc(firestore, 'timeline', id), input);
  };

  const addLetter = async (input: { title: string; message: string; date: string; photoUri?: string }, onProgress?: (value: number) => void) => {
    const { user, firestore } = requireCloud();
    const photoUrl = input.photoUri ? await uploadAsset(input.photoUri, `letters/${user.id}/${Date.now()}`, onProgress) : '';
    await addDoc(collection(firestore, 'letters'), { title: input.title.trim(), message: input.message.trim(), date: input.date, authorId: user.id, authorName: user.name, openedBy: [], ...(photoUrl ? { photoUrl } : {}) });
  };

  const markLetterOpened = async (id: string) => {
    const { user, firestore } = requireCloud();
    const letter = letters.find((item) => item.id === id);
    await updateDoc(doc(firestore, 'letters', id), { openedBy: Array.from(new Set([...(letter?.openedBy ?? []), user.id])) });
  };

  const addSong = async (input: { title: string; artist: string; audioUri: string; coverUri?: string }, onProgress?: (value: number) => void) => {
    const { user, firestore } = requireCloud();
    const audioUrl = await uploadAsset(input.audioUri, `songs/${user.id}/${Date.now()}.audio`, onProgress);
    const coverUrl = input.coverUri ? await uploadAsset(input.coverUri, `songs/${user.id}/${Date.now()}.cover`) : '';
    await addDoc(collection(firestore, 'songs'), { title: input.title.trim(), artist: input.artist.trim(), audioUrl, ...(coverUrl ? { coverUrl } : {}), uploadedBy: user.name, createdAt: serverTimestamp() });
  };

  const updateSettings = async (input: Partial<Omit<CloudSettings, 'id'>>) => {
    const { firestore } = requireCloud();
    await setDoc(doc(firestore, 'settings', 'space'), input, { merge: true });
  };

  const updateProfile = async (input: Partial<Pick<CloudUser, 'name' | 'photoUrl'>>) => {
    const { user, firestore } = requireCloud();
    await updateDoc(doc(firestore, 'users', user.id), input);
    setCurrentUser((current) => current ? { ...current, ...input, initials: (input.name ?? current.name).slice(0, 1).toUpperCase() } : current);
  };

  const value = useMemo<CloudContextValue>(() => ({
    currentUser,
    settings,
    messages,
    memories,
    photos,
    timeline,
    letters,
    songs,
    isLoading,
    isFirebaseConfigured,
    error,
    login,
    logout,
    sendMessage,
    markMessageRead,
    addMemory,
    updateMemory,
    deleteMemory,
    addPhoto,
    addTimeline,
    updateTimeline,
    deleteTimeline,
    addLetter,
    markLetterOpened,
    addSong,
    updateSettings,
    updateProfile,
    uploadAsset,
  }), [currentUser, settings, messages, memories, photos, timeline, letters, songs, isLoading, error]);

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloudApp() {
  const context = useContext(CloudContext);
  if (!context) throw new Error('useCloudApp must be used inside CloudProvider');
  return context;
}
