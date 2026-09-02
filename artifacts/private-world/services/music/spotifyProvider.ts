import type { MusicProvider, MusicTrack, PlaybackState } from './types';

/**
 * Spotify is deliberately not backed by the local audio player. A production
 * Android bridge must call the official Spotify App Remote SDK, which controls
 * the authenticated Spotify app and never exposes an audio stream to us.
 */
export class SpotifyProvider implements MusicProvider {
  readonly id = 'spotify' as const;

  private unavailable(): never {
    throw new Error('Spotify playback needs the official Android App Remote bridge and an authorized Spotify account.');
  }

  async getState(): Promise<PlaybackState> {
    return { provider: 'spotify', track: null, isPlaying: false, positionMs: 0, durationMs: 0 };
  }

  async play(_track: MusicTrack): Promise<void> { this.unavailable(); }
  async pause(): Promise<void> { this.unavailable(); }
  async resume(): Promise<void> { this.unavailable(); }
  async seek(_positionMs: number): Promise<void> { this.unavailable(); }
  async next(): Promise<void> { this.unavailable(); }
  async previous(): Promise<void> { this.unavailable(); }
}
