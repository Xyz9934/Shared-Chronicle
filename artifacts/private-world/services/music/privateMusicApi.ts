import { auth } from '@/services/firebase';
import { supabase } from '@/services/supabase';
import {
  extensionFromFilename,
  isSupportedPrivateAudio,
  maxPrivateMusicBytes,
  type PrivateMusicTrack,
} from './types';

const apiBaseUrl = (process.env.EXPO_PUBLIC_AUTH_API_URL ?? 'https://shared-chronicle--faizaniqubal206.replit.app')
  .trim()
  .replace(/\/+$/, '');

type UploadTicket = { id: string; path: string; token: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const user = auth?.currentUser;
  if (!user) throw new Error('A verified Firebase session is required.');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Music service request failed.');
  return body as T;
}

export async function listPrivateMusic(): Promise<PrivateMusicTrack[]> {
  const result = await request<{ items: PrivateMusicTrack[] }>('/api/music');
  return result.items;
}

export async function getPrivateMusicDownloadUrl(id: string): Promise<string> {
  const result = await request<{ url: string }>(`/api/music/${encodeURIComponent(id)}/download-url`);
  return result.url;
}

export async function uploadPrivateMusic(input: {
  uri: string;
  filename: string;
  mimeType?: string | null;
  fileSize?: number | null;
  title: string;
  artist?: string;
  album?: string;
  durationMs?: number;
}, onProgress?: (value: number) => void): Promise<PrivateMusicTrack> {
  const filename = input.filename.trim();
  const mimeType = input.mimeType?.toLowerCase() || 'application/octet-stream';
  if (!isSupportedPrivateAudio(filename, mimeType)) throw new Error('Choose an MP3, M4A/AAC, WAV, OGG, or Opus file.');
  if (input.fileSize && input.fileSize > maxPrivateMusicBytes) throw new Error('Songs must be 100 MB or smaller.');
  if (!supabase) throw new Error('Supabase storage is not configured.');

  const ticket = await request<UploadTicket>('/api/music/upload-ticket', {
    method: 'POST',
    body: JSON.stringify({ filename, mimeType, fileSize: input.fileSize ?? null }),
  });
  onProgress?.(0.05);
  const response = await fetch(input.uri);
  if (!response.ok) throw new Error('The selected audio file could not be read.');
  const blob = await response.blob();
  if (blob.size > maxPrivateMusicBytes) throw new Error('Songs must be 100 MB or smaller.');
  const { error: uploadError } = await supabase.storage
    .from('private-world-media')
    .uploadToSignedUrl(ticket.path, ticket.token, blob, { contentType: mimeType });
  if (uploadError) throw new Error(`Audio upload failed: ${uploadError.message}`);
  onProgress?.(0.85);
  const result = await request<{ item: PrivateMusicTrack }>('/api/music', {
    method: 'POST',
    body: JSON.stringify({
      id: ticket.id,
      filename,
      mimeType,
      title: input.title.trim() || filename.replace(/\.[^/.]+$/, ''),
      artist: input.artist?.trim() || null,
      album: input.album?.trim() || null,
      durationMs: input.durationMs ?? null,
      extension: extensionFromFilename(filename),
    }),
  });
  onProgress?.(1);
  return result.item;
}

export async function deletePrivateMusic(id: string): Promise<void> {
  await request(`/api/music/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
