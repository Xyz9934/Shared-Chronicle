import { auth } from './firebase';
import { scheduleUploadAsync } from '@/modules/media-sync';
import type { LocalMediaRecord } from './mediaSyncTypes';

const apiBaseUrl = (process.env.EXPO_PUBLIC_AUTH_API_URL ?? '').trim().replace(/\/+$/, '');

export async function scheduleQueuedMediaUpload(
  spaceId: string,
  deviceId: string,
  item: LocalMediaRecord & { serverMediaId: string },
  options: { wifiOnly: boolean; chargingOnly: boolean },
): Promise<string> {
  if (!auth?.currentUser) throw new Error('A signed-in Firebase user is required to upload media.');
  if (!apiBaseUrl) throw new Error('EXPO_PUBLIC_AUTH_API_URL is required for media synchronization.');

  const firebaseToken = await auth.currentUser.getIdToken();
  return scheduleUploadAsync({
    mediaId: item.serverMediaId,
    apiBaseUrl,
    spaceId,
    firebaseToken,
    deviceId,
    sourceMediaId: item.sourceMediaId,
    sourceUri: item.sourceUri,
    mediaType: item.mediaType,
    mimeType: item.mimeType,
    filename: item.filename ?? undefined,
    fileSize: item.fileSize ?? undefined,
    modifiedAtSource: item.modifiedAt ? new Date(item.modifiedAt).toISOString() : undefined,
    wifiOnly: options.wifiOnly,
    chargingOnly: options.chargingOnly,
  });
}
