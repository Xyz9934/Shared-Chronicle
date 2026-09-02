export type MusicProviderId = 'private' | 'spotify';

export type MusicTrack = {
  id: string;
  provider: MusicProviderId;
  title: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  durationMs?: number;
};

export type PrivateMusicTrack = MusicTrack & {
  provider: 'private';
  spaceId: string;
  uploadedById: string;
  uploadedByName: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
  streamUrl?: string;
};

export type PlaybackState = {
  provider: MusicProviderId | null;
  track: MusicTrack | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
};

/** UI-level contract. Providers must only expose actions their service permits. */
export interface MusicProvider {
  readonly id: MusicProviderId;
  getState(): Promise<PlaybackState>;
  play(track: MusicTrack): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
}

export const supportedAudioTypes: Record<string, string[]> = {
  'audio/mpeg': ['mp3'],
  'audio/mp4': ['m4a', 'aac'],
  'audio/aac': ['aac'],
  'audio/wav': ['wav'],
  'audio/ogg': ['ogg', 'opus'],
  'audio/opus': ['opus'],
};

export const maxPrivateMusicBytes = 100 * 1024 * 1024;

export function extensionFromFilename(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return match?.[1]?.toLowerCase() ?? '';
}

export function isSupportedPrivateAudio(filename: string, mimeType?: string | null): boolean {
  const extension = extensionFromFilename(filename);
  if (!extension) return false;
  const declared = mimeType?.toLowerCase();
  return Object.entries(supportedAudioTypes).some(([type, extensions]) =>
    extensions.includes(extension) && (!declared || declared === type || declared === 'audio/*' || declared === 'application/octet-stream'),
  );
}
