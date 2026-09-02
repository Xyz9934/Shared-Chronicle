import Constants from 'expo-constants';
import type { NotificationResponse } from 'expo-notifications';
import { Platform } from 'react-native';
import { auth } from '@/services/firebase';

const backendBaseUrl = (process.env.EXPO_PUBLIC_AUTH_API_URL ?? 'https://shared-chronicle--faizaniqubal206.replit.app').trim().replace(/\/+$/, '');
const webPushVapidPublicKey = process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? '';
const webBasePath = (process.env.EXPO_PUBLIC_WEB_BASE_PATH ?? '/').replace(/^\/?/, '/').replace(/\/+$/, '') + '/';

type NotificationData = Record<string, unknown>;
type NotificationResponseHandler = (data: NotificationData) => void;
export type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const projectId = Constants.expoConfig?.extra?.eas?.projectId
  ?? (Constants as typeof Constants & { easConfig?: { projectId?: string } }).easConfig?.projectId;
let notificationsModule: typeof import('expo-notifications') | null = null;

function getNotifications(): typeof import('expo-notifications') | null {
  if (Platform.OS === 'web') return null;
  return notificationsModule ??= require('expo-notifications') as typeof import('expo-notifications');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = globalThis.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

try {
  const nativeNotifications = getNotifications();
  if (nativeNotifications) {
    nativeNotifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: false,
      }),
    });
  }
} catch (error) {
  console.error('[Notifications] Initialization failed', {
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}

export async function registerWebPushNotificationsAsync(requestPermission = false): Promise<WebPushSubscription | null> {
  if (Platform.OS !== 'web' || !webPushVapidPublicKey || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    if (Notification.permission === 'default' && requestPermission) await Notification.requestPermission();
    if (Notification.permission !== 'granted') return null;
    const registration = await navigator.serviceWorker.register(`${webBasePath}sw.js`, { scope: webBasePath });
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(webPushVapidPublicKey) as unknown as BufferSource,
      });
    }
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
    return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
  } catch {
    return null;
  }
}

export async function notifyNewChatMessage(messageId: string): Promise<void> {
  const user = auth?.currentUser;
  if (!user) return;
  try {
    const token = await user.getIdToken();
    await fetch(`${backendBaseUrl}/notifications/chat-message`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });
  } catch {
    // Push delivery is best effort and must not affect chat persistence.
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const Notifications = getNotifications();
  if (!Notifications) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chat-messages', {
      name: 'Chat messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      granted = requested.granted;
    }

    if (!granted || !projectId) return null;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

export function subscribeToNotificationResponses(onResponse: NotificationResponseHandler): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const Notifications = getNotifications();
  if (!Notifications) return () => undefined;

  const handleResponse = (response: NotificationResponse) => {
    const data = response.notification.request.content.data;
    onResponse(data && typeof data === 'object' ? data as NotificationData : {});
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handleResponse(response);
  }).catch(() => {
    // Notification response lookup is best effort during app startup.
  });

  return () => subscription.remove();
}
