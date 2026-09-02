import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { extensionFromFilename, type PrivateMusicTrack } from './types';
import { getPrivateMusicDownloadUrl } from './privateMusicApi';

type DownloadEntry = {
  musicId: string;
  localPath: string;
  downloadedAt: string;
  fileSize: number;
};

const cacheKey = '@private-world/music-downloads-v1';

async function readIndex(): Promise<Record<string, DownloadEntry>> {
  const raw = await AsyncStorage.getItem(cacheKey);
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, DownloadEntry>; } catch { return {}; }
}

async function writeIndex(index: Record<string, DownloadEntry>) {
  await AsyncStorage.setItem(cacheKey, JSON.stringify(index));
}

function musicDirectory(): string {
  if (!FileSystem.documentDirectory) throw new Error('Offline downloads are available only in the installed mobile app.');
  return `${FileSystem.documentDirectory}private-world-music/`;
}

export async function getCachedMusicUri(musicId: string): Promise<string | null> {
  const entry = (await readIndex())[musicId];
  if (!entry) return null;
  const info = await FileSystem.getInfoAsync(entry.localPath);
  if (info.exists) return entry.localPath;
  const index = await readIndex();
  delete index[musicId];
  await writeIndex(index);
  return null;
}

export async function downloadPrivateMusic(track: PrivateMusicTrack, onProgress?: (progress: number) => void): Promise<string> {
  const directory = musicDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
  const extension = extensionFromFilename(track.originalFilename) || 'audio';
  const destination = `${directory}${track.id}.${extension}`;
  const downloadUrl = await getPrivateMusicDownloadUrl(track.id);
  const download = FileSystem.createDownloadResumable(downloadUrl, destination, {}, (event) => {
    if (event.totalBytesExpectedToWrite > 0) onProgress?.(event.totalBytesWritten / event.totalBytesExpectedToWrite);
  });
  const result = await download.downloadAsync();
  if (!result?.uri) throw new Error('The audio download did not finish.');
  const index = await readIndex();
  index[track.id] = { musicId: track.id, localPath: result.uri, downloadedAt: new Date().toISOString(), fileSize: track.fileSize };
  await writeIndex(index);
  return result.uri;
}

export async function removePrivateMusicDownload(musicId: string): Promise<void> {
  const index = await readIndex();
  const entry = index[musicId];
  if (entry) await FileSystem.deleteAsync(entry.localPath, { idempotent: true }).catch(() => undefined);
  delete index[musicId];
  await writeIndex(index);
}
