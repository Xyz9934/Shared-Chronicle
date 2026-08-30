import { auth } from './firebase';
import type { MediaAccessStatus } from '@/modules/media-sync';

export type GalleryMedia = {
  id: string;
  spaceId: string;
  ownerId: string;
  deviceId: string | null;
  sourceMediaId: string;
  mediaType: 'photo' | 'video';
  mimeType: string;
  filename: string | null;
  fileSize: number | null;
  createdAtSource: string | null;
  modifiedAtSource: string | null;
  contentHash: string | null;
  storagePath: string;
  thumbnailPath: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'deleted';
  uploadAttempts: number;
  lastError: string | null;
  uploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GalleryPage = {
  items: GalleryMedia[];
  total: number;
  limit: number;
  offset: number;
};

export type GallerySyncSettings = {
  spaceId: string;
  userId: string;
  enabled: boolean;
  photosEnabled: boolean;
  videosEnabled: boolean;
  wifiOnly: boolean;
  chargingOnly: boolean;
  backgroundSyncEnabled: boolean;
  paused: boolean;
};

const defaultApiBaseUrl = 'https://shared-chronicle--faizaniqubal206.replit.app';
export const mediaApiBaseUrl = (process.env.EXPO_PUBLIC_AUTH_API_URL ?? defaultApiBaseUrl).trim().replace(/\/+$/, '');
export const mediaSpaceId = (process.env.EXPO_PUBLIC_PRIVATE_SPACE_ID ?? '').trim();

export const isMediaApiConfigured = Boolean(mediaApiBaseUrl && mediaSpaceId);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const user = auth?.currentUser;
  if (!user) throw new Error('A verified Firebase session is required.');
  const makeRequest = (token: string) => fetch(`${mediaApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const token = await user.getIdToken();
  let response = await makeRequest(token);
  if (response.status === 401) {
    const refreshedToken = await user.getIdToken(true);
    if (refreshedToken !== token) response = await makeRequest(refreshedToken);
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : `Media service returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return data as T;
}

function requireSpaceId(spaceId = mediaSpaceId): string {
  if (!spaceId) throw new Error('EXPO_PUBLIC_PRIVATE_SPACE_ID is required for synchronized media.');
  return spaceId;
}

export async function fetchGalleryPage(options: {
  offset?: number;
  limit?: number;
  mediaType?: 'photo' | 'video';
  ownerId?: string;
} = {}): Promise<GalleryPage> {
  const params = new URLSearchParams({
    spaceId: requireSpaceId(),
    offset: String(Math.max(options.offset ?? 0, 0)),
    limit: String(Math.min(Math.max(options.limit ?? 40, 1), 100)),
  });
  if (options.mediaType) params.set('mediaType', options.mediaType);
  if (options.ownerId) params.set('ownerId', options.ownerId);
  return request<GalleryPage>(`/api/media?${params.toString()}`);
}

export async function fetchMediaDownloadUrl(mediaId: string, thumbnail = true): Promise<string> {
  const params = new URLSearchParams({ spaceId: requireSpaceId(), thumbnail: String(thumbnail) });
  const data = await request<{ url: string }>(`/api/media/${encodeURIComponent(mediaId)}/download-url?${params.toString()}`);
  return data.url;
}

export async function fetchGallerySyncSettings(): Promise<GallerySyncSettings> {
  const params = new URLSearchParams({ spaceId: requireSpaceId() });
  return request<GallerySyncSettings>(`/api/media/sync/settings?${params.toString()}`);
}

export async function updateGallerySyncSettings(input: Partial<Omit<GallerySyncSettings, 'spaceId' | 'userId'>>): Promise<GallerySyncSettings> {
  const params = new URLSearchParams({ spaceId: requireSpaceId() });
  return request<GallerySyncSettings>(`/api/media/sync/settings?${params.toString()}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function registerGalleryDevice(input: { deviceKey: string; model?: string; appVersion?: string }): Promise<{ id: string }> {
  const params = new URLSearchParams({ spaceId: requireSpaceId() });
  return request<{ id: string }>(`/api/media/devices?${params.toString()}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getGalleryStatusLabel(status: MediaAccessStatus): string {
  if (status === 'full') return 'Full media access';
  if (status === 'partial') return 'Limited media access';
  if (status === 'denied') return 'Permission required';
  return 'Android app required';
}
