import {
  addSpotifyPlayerStateListener,
  connectSpotifyAsync,
  disconnectSpotify,
  isSpotifyConnected,
  pauseSpotifyAsync,
  playSpotifyUriAsync,
  resumeSpotifyAsync,
  seekSpotifyToAsync,
  skipSpotifyNextAsync,
  skipSpotifyPreviousAsync,
  type SpotifyPlayerState,
} from '@private-world/spotify';
import type { MusicProvider, MusicTrack, PlaybackState } from './types';

export class SpotifyProvider implements MusicProvider {
  readonly id = 'spotify' as const;
  private state: SpotifyPlayerState = { isPaused: true, positionMs: 0, durationMs: 0, track: null };

  async connect(): Promise<void> {
    const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
    const redirectUri = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI ?? 'private-world://spotify-callback';
    await connectSpotifyAsync(clientId, redirectUri);
  }

  disconnect(): void {
    disconnectSpotify();
    this.state = { isPaused: true, positionMs: 0, durationMs: 0, track: null };
  }

  isConnected(): boolean {
    return isSpotifyConnected();
  }

  subscribe(listener: (state: PlaybackState) => void): () => void {
    const subscription = addSpotifyPlayerStateListener((state) => {
      this.state = state;
      listener(this.toPlaybackState());
    });
    return () => subscription?.remove();
  }

  private toPlaybackState(): PlaybackState {
    const track = this.state.track;
    return {
      provider: 'spotify',
      track: track ? {
        id: track.uri,
        provider: 'spotify',
        title: track.title,
        artist: track.artist,
        album: track.album,
      } : null,
      isPlaying: !this.state.isPaused,
      positionMs: this.state.positionMs,
      durationMs: this.state.durationMs,
    };
  }

  async getState(): Promise<PlaybackState> {
    return this.toPlaybackState();
  }

  async play(track: MusicTrack): Promise<void> { await playSpotifyUriAsync(track.id); }
  async pause(): Promise<void> { await pauseSpotifyAsync(); }
  async resume(): Promise<void> { await resumeSpotifyAsync(); }
  async seek(positionMs: number): Promise<void> { await seekSpotifyToAsync(positionMs); }
  async next(): Promise<void> { await skipSpotifyNextAsync(); }
  async previous(): Promise<void> { await skipSpotifyPreviousAsync(); }
}
