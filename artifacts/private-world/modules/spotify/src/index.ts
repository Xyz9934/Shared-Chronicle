import { requireOptionalNativeModule, EventEmitter, type EventSubscription } from 'expo-modules-core';
import { Platform } from 'react-native';

export type SpotifyPlayerState = {
  isPaused: boolean;
  positionMs: number;
  durationMs: number;
  track: {
    uri: string;
    title: string;
    artist?: string;
    album?: string;
  } | null;
};

type SpotifyNativeModule = {
  connect(clientId: string, redirectUri: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  play(uri: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  skipNext(): Promise<void>;
  skipPrevious(): Promise<void>;
  seekTo(positionMs: number): Promise<void>;
};

const nativeModule = Platform.OS === 'android'
  ? requireOptionalNativeModule<SpotifyNativeModule>('Spotify')
  : null;
const emitter = nativeModule ? new EventEmitter(nativeModule as any) : null;

export function isSpotifyNativeAvailable(): boolean {
  return nativeModule !== null;
}

export async function connectSpotifyAsync(clientId: string, redirectUri: string): Promise<void> {
  if (!nativeModule) throw new Error('Spotify requires an Android development build.');
  if (!clientId.trim()) throw new Error('Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID before connecting Spotify.');
  if (!redirectUri.trim()) throw new Error('Set EXPO_PUBLIC_SPOTIFY_REDIRECT_URI before connecting Spotify.');
  return nativeModule.connect(clientId.trim(), redirectUri.trim());
}

export function disconnectSpotify(): void {
  nativeModule?.disconnect();
}

export function isSpotifyConnected(): boolean {
  return nativeModule?.isConnected() ?? false;
}

export async function playSpotifyUriAsync(uri: string): Promise<void> {
  if (!nativeModule) throw new Error('Spotify requires an Android development build.');
  return nativeModule.play(uri);
}

export async function pauseSpotifyAsync(): Promise<void> {
  if (!nativeModule) throw new Error('Spotify requires an Android development build.');
  return nativeModule.pause();
}

export async function resumeSpotifyAsync(): Promise<void> {
  if (!nativeModule) throw new Error('Spotify requires an Android development build.');
  return nativeModule.resume();
}

export async function skipSpotifyNextAsync(): Promise<void> {
  if (!nativeModule) throw new Error('Spotify requires an Android development build.');
  return nativeModule.skipNext();
}

export async function skipSpotifyPreviousAsync(): Promise<void> {
  if (!nativeModule) throw new Error('Spotify requires an Android development build.');
  return nativeModule.skipPrevious();
}

export async function seekSpotifyToAsync(positionMs: number): Promise<void> {
  if (!nativeModule) throw new Error('Spotify requires an Android development build.');
  return nativeModule.seekTo(Math.max(0, Math.floor(positionMs)));
}

export function addSpotifyPlayerStateListener(listener: (state: SpotifyPlayerState) => void): EventSubscription | null {
  return emitter ? (emitter as any).addListener('onPlayerStateChanged', listener) : null;
}
