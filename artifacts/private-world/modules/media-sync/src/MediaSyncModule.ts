import { requireOptionalNativeModule } from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';

export type MediaAccessStatus = 'full' | 'partial' | 'denied' | 'unsupported';

export type MediaScanItem = {
  sourceMediaId: string;
  sourceUri: string;
  mediaType: 'photo' | 'video';
  mimeType: string;
  filename: string | null;
  fileSize: number | null;
  createdAt: number | null;
  modifiedAt: number | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

export type MediaScanPage = {
  items: MediaScanItem[];
  hasMore: boolean;
};

export type MediaSyncNativeModule = {
  getMediaAccessStatus(): MediaAccessStatus;
  scanMediaPage(options: {
    afterModifiedAt?: number;
    limit?: number;
    includePhotos?: boolean;
    includeVideos?: boolean;
  }): MediaScanPage;
  scheduleUpload(options: MediaUploadOptions): string;
  cancelUpload(mediaId: string): void;
};

export type MediaUploadOptions = {
  mediaId: string;
  apiBaseUrl: string;
  spaceId: string;
  firebaseToken: string;
  deviceId: string;
  sourceMediaId: string;
  sourceUri: string;
  mediaType: 'photo' | 'video';
  mimeType: string;
  filename?: string;
  fileSize?: number;
  createdAtSource?: string;
  modifiedAtSource?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  wifiOnly?: boolean;
  chargingOnly?: boolean;
};

export const MediaSyncModule = requireOptionalNativeModule<MediaSyncNativeModule>('MediaSync');

const permission = (name: string) => name as Parameters<typeof PermissionsAndroid.check>[0];

export async function getMediaAccessStatusAsync(): Promise<MediaAccessStatus> {
  if (Platform.OS !== 'android' || !MediaSyncModule) return 'unsupported';
  return MediaSyncModule.getMediaAccessStatus();
}

export async function scheduleUploadAsync(options: MediaUploadOptions): Promise<string> {
  if (Platform.OS !== 'android' || !MediaSyncModule) {
    throw new Error('Background media uploads require an Android development build.');
  }
  return MediaSyncModule.scheduleUpload(options);
}

export function cancelUpload(mediaId: string): void {
  if (Platform.OS === 'android') MediaSyncModule?.cancelUpload(mediaId);
}

export async function requestMediaAccessAsync(): Promise<MediaAccessStatus> {
  if (Platform.OS !== 'android' || !MediaSyncModule) return 'unsupported';

  const permissions = Platform.Version >= 33
    ? [
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        ...(Platform.Version >= 34 ? ['android.permission.READ_MEDIA_VISUAL_USER_SELECTED'] : []),
      ]
    : ['android.permission.READ_EXTERNAL_STORAGE'];

  await PermissionsAndroid.requestMultiple(
    permissions as Parameters<typeof PermissionsAndroid.requestMultiple>[0],
  );
  return getMediaAccessStatusAsync();
}

export async function scanMediaPageAsync(options: {
  afterModifiedAt?: number;
  limit?: number;
  includePhotos?: boolean;
  includeVideos?: boolean;
} = {}): Promise<MediaScanPage> {
  if (Platform.OS !== 'android' || !MediaSyncModule) {
    return { items: [], hasMore: false };
  }

  return MediaSyncModule.scanMediaPage({
    ...options,
    limit: Math.min(Math.max(Math.trunc(options.limit ?? 100), 1), 500),
  });
}

export async function hasLegacyStoragePermissionAsync(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version >= 33) return false;
  return PermissionsAndroid.check(permission('android.permission.READ_EXTERNAL_STORAGE'));
}
