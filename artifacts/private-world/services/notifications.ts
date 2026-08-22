import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { auth } from '@/services/firebase';

const backendBaseUrl = (process.env.EXPO_PUBLIC_AUTH_API_URL ?? 'https://shared-chronicle--faizaniqubal206.replit.app').trim().replace(/\/+$/, '');

type NotificationData = Record<string, unknown>;
type NotificationResponseHandler = (data: NotificationData) => void;

const projectId = Constants.expoConfig?.extra?.eas?.projectId
  ?? (Constants as typeof Constants & { easConfig?: { projectId?: string } }).easConfig?.projectId;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });
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
    let status = current.status;
    if (status !== Notifications.PermissionStatus.GRANTED) {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      status = requested.status;
    }

    if (status !== Notifications.PermissionStatus.GRANTED || !projectId) return null;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

export function subscribeToNotificationResponses(onResponse: NotificationResponseHandler): () => void {
  if (Platform.OS === 'web') return () => undefined;

  const handleResponse = (response: Notifications.NotificationResponse) => {
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
