import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { isFirebaseConfigured } from '@/services/firebase';

export type Role = 'OWNER' | 'USER';
export type AppSection = 'home' | 'chat' | 'memories' | 'gallery';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
};

export type Message = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  read: boolean;
};

export type Memory = {
  id: string;
  title: string;
  description: string;
  date: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  imageKey?: 'coffee' | 'letter' | 'sunset';
  imageUri?: string;
};

export type Photo = {
  id: string;
  uri: string;
  caption: string;
  date: string;
  uploadedBy: string;
  createdAt: string;
};

type PersistedData = {
  messages: Message[];
  memories: Memory[];
  photos: Photo[];
};

type AppContextValue = {
  currentUser: AppUser | null;
  messages: Message[];
  memories: Memory[];
  photos: Photo[];
  isLoading: boolean;
  isFirebaseConfigured: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  sendMessage: (text: string) => Promise<void>;
  addMemory: (input: Pick<Memory, 'title' | 'description' | 'date' | 'imageKey' | 'imageUri'>) => Promise<void>;
  addPhoto: (input: Pick<Photo, 'uri' | 'caption' | 'date'>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
};

const STORAGE_KEY = '@private-world/content';

const demoUsers: Array<AppUser & { password: string }> = [
  { id: 'owner', name: 'Aarav', email: 'owner@private.world', password: 'owner123', role: 'OWNER', initials: 'A' },
  { id: 'user', name: 'Mira', email: 'mira@private.world', password: 'mira123', role: 'USER', initials: 'M' },
];

const starterData: PersistedData = {
  messages: [
    {
      id: 'message-1',
      text: 'I saved a little corner of today for us.',
      senderId: 'owner',
      senderName: 'Aarav',
      createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      read: true,
    },
    {
      id: 'message-2',
      text: 'It already feels like our place.',
      senderId: 'user',
      senderName: 'Mira',
      createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      read: true,
    },
  ],
  memories: [
    {
      id: 'memory-sunset',
      title: 'The quiet kind of beautiful',
      description: 'A soft evening, a long conversation, and nowhere else we needed to be.',
      date: '18 August 2026',
      creatorId: 'owner',
      creatorName: 'Aarav',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      imageKey: 'sunset',
    },
    {
      id: 'memory-coffee',
      title: 'Our random evening',
      description: 'One of those ordinary days that somehow became special.',
      date: '16 August 2026',
      creatorId: 'user',
      creatorName: 'Mira',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      imageKey: 'coffee',
    },
    {
      id: 'memory-letter',
      title: 'Words worth keeping',
      description: 'A reminder that the smallest gestures can stay with us the longest.',
      date: '12 August 2026',
      creatorId: 'owner',
      creatorName: 'Aarav',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
      imageKey: 'letter',
    },
  ],
  photos: [],
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const persist = async (data: PersistedData) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [data, setData] = useState<PersistedData>(starterData);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setData(JSON.parse(stored) as PersistedData);
        }
      } catch {
        setData(starterData);
      } finally {
        setIsLoading(false);
      }
    };
    void restore();
  }, []);

  const updateData = async (next: PersistedData) => {
    setData(next);
    await persist(next);
  };

  const login = async (email: string, password: string) => {
    const match = demoUsers.find(
      (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase() && candidate.password === password,
    );
    if (!match) return false;
    const { password: _password, ...safeUser } = match;
    setCurrentUser(safeUser);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const sendMessage = async (text: string) => {
    if (!currentUser || !text.trim()) return;
    const next: PersistedData = {
      ...data,
      messages: [
        ...data.messages,
        {
          id: makeId('message'),
          text: text.trim(),
          senderId: currentUser.id,
          senderName: currentUser.name,
          createdAt: new Date().toISOString(),
          read: true,
        },
      ],
    };
    await updateData(next);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addMemory = async (input: Pick<Memory, 'title' | 'description' | 'date' | 'imageKey' | 'imageUri'>) => {
    if (!currentUser) return;
    const next: PersistedData = {
      ...data,
      memories: [
        {
          ...input,
          id: makeId('memory'),
          creatorId: currentUser.id,
          creatorName: currentUser.name,
          createdAt: new Date().toISOString(),
        },
        ...data.memories,
      ],
    };
    await updateData(next);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const addPhoto = async (input: Pick<Photo, 'uri' | 'caption' | 'date'>) => {
    if (!currentUser) return;
    const next: PersistedData = {
      ...data,
      photos: [
        {
          ...input,
          id: makeId('photo'),
          uploadedBy: currentUser.name,
          createdAt: new Date().toISOString(),
        },
        ...data.photos,
      ],
    };
    await updateData(next);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deleteMemory = async (id: string) => {
    if (currentUser?.role !== 'OWNER') return;
    await updateData({ ...data, memories: data.memories.filter((memory) => memory.id !== id) });
  };

  const value = useMemo<AppContextValue>(
    () => ({
      currentUser,
      messages: data.messages,
      memories: data.memories,
      photos: data.photos,
      isLoading,
      isFirebaseConfigured,
      login,
      logout,
      sendMessage,
      addMemory,
      addPhoto,
      deleteMemory,
    }),
    [currentUser, data, isLoading],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}

export { demoUsers, starterData };
