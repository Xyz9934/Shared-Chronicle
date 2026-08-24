import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getMediaAccessStatusAsync,
  requestMediaAccessAsync,
  scanMediaPageAsync,
  type MediaAccessStatus,
} from '@/modules/media-sync';
import {
  enqueueMedia,
  getLocalSyncSettings,
  initializeMediaSyncDatabase,
  listQueueItems,
  resetStaleUploads,
  updateLocalSyncSettings,
} from '@/services/mediaSyncRepository';
import {
  fetchGallerySyncSettings as fetchServerSettings,
  isMediaApiConfigured,
  registerGalleryDevice,
  updateGallerySyncSettings,
} from '@/services/mediaGalleryApi';
import type { LocalSyncSettings } from '@/services/mediaSyncTypes';

export type MediaSyncStatus = 'disabled' | 'permission_required' | 'active' | 'scanning' | 'paused' | 'complete' | 'error';

type QueueSummary = {
  total: number;
  pending: number;
  uploading: number;
  completed: number;
  failed: number;
};

const deviceKeyStorage = '@private-world/media-device-key';

function makeDeviceKey(): string {
  return `android-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getDeviceKey(): Promise<string> {
  const existing = await AsyncStorage.getItem(deviceKeyStorage);
  if (existing) return existing;
  const created = makeDeviceKey();
  await AsyncStorage.setItem(deviceKeyStorage, created);
  return created;
}

export function useMediaSync() {
  const [permission, setPermission] = useState<MediaAccessStatus>('unsupported');
  const [settings, setSettings] = useState<LocalSyncSettings>({
    enabled: false,
    photosEnabled: true,
    videosEnabled: true,
    wifiOnly: true,
    chargingOnly: false,
    backgroundSyncEnabled: true,
    paused: false,
  });
  const [summary, setSummary] = useState<QueueSummary>({ total: 0, pending: 0, uploading: 0, completed: 0, failed: 0 });
  const [isBusy, setIsBusy] = useState(true);
  const [error, setError] = useState('');

  const refreshQueue = useCallback(async () => {
    const items = await listQueueItems(undefined, 500);
    const next = items.reduce<QueueSummary>((value, item) => {
      value.total += 1;
      if (item.status === 'PENDING' || item.status === 'RETRYING') value.pending += 1;
      if (item.status === 'UPLOADING' || item.status === 'PROCESSING') value.uploading += 1;
      if (item.status === 'COMPLETED') value.completed += 1;
      if (item.status === 'FAILED') value.failed += 1;
      return value;
    }, { total: 0, pending: 0, uploading: 0, completed: 0, failed: 0 });
    setSummary(next);
  }, []);

  const scanAndQueue = useCallback(async (nextSettings: LocalSyncSettings) => {
    setError('');
    setIsBusy(true);
    try {
      let afterModifiedAt = 0;
      let hasMore = true;
      while (hasMore) {
        const page = await scanMediaPageAsync({
          afterModifiedAt,
          limit: 200,
          includePhotos: nextSettings.photosEnabled,
          includeVideos: nextSettings.videosEnabled,
        });
        for (const item of page.items) {
          await enqueueMedia({
            sourceMediaId: item.sourceMediaId,
            sourceUri: item.sourceUri,
            mediaType: item.mediaType,
            mimeType: item.mimeType,
            filename: item.filename,
            fileSize: item.fileSize,
            modifiedAt: item.modifiedAt,
            contentHash: null,
            serverMediaId: null,
            status: 'PENDING',
            attempts: 0,
            lastError: null,
          });
        }
        const newest = page.items.reduce((value, item) => Math.max(value, item.modifiedAt ?? value), afterModifiedAt);
        hasMore = page.hasMore && newest > afterModifiedAt;
        afterModifiedAt = newest;
      }
      await refreshQueue();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Media scanning failed.');
    } finally {
      setIsBusy(false);
    }
  }, [refreshQueue]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await initializeMediaSyncDatabase();
        await resetStaleUploads();
        const [localSettings, access] = await Promise.all([getLocalSyncSettings(), getMediaAccessStatusAsync()]);
        if (!active) return;
        setSettings(localSettings);
        setPermission(access);
        await refreshQueue();
        if (isMediaApiConfigured) {
          try {
            const serverSettings = await fetchServerSettings();
            if (active) {
              const merged = {
                enabled: serverSettings.enabled,
                photosEnabled: serverSettings.photosEnabled,
                videosEnabled: serverSettings.videosEnabled,
                wifiOnly: serverSettings.wifiOnly,
                chargingOnly: serverSettings.chargingOnly,
                backgroundSyncEnabled: serverSettings.backgroundSyncEnabled,
                paused: serverSettings.paused,
              };
              setSettings(merged);
              await updateLocalSyncSettings(merged);
            }
          } catch {
            // Local settings remain authoritative while the API is unavailable.
          }
        }
      } catch (initializationError) {
        if (active) setError(initializationError instanceof Error ? initializationError.message : 'Media sync could not be initialized.');
      } finally {
        if (active) setIsBusy(false);
      }
    })();
    return () => { active = false; };
  }, [refreshQueue]);

  const enableSync = useCallback(async () => {
    setIsBusy(true);
    setError('');
    try {
      const access = await requestMediaAccessAsync();
      setPermission(access);
      if (access !== 'full' && access !== 'partial') {
        setError(access === 'unsupported' ? 'Media Sync requires the Android development build.' : 'Allow photo and video access to enable Media Sync.');
        return;
      }
      const nextSettings = await updateLocalSyncSettings({ enabled: true, paused: false });
      setSettings(nextSettings);
      if (isMediaApiConfigured) {
        const deviceKey = await getDeviceKey();
        await registerGalleryDevice({ deviceKey });
        await updateGallerySyncSettings(nextSettings);
      }
      await scanAndQueue(nextSettings);
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : 'Media Sync could not be enabled.');
    } finally {
      setIsBusy(false);
    }
  }, [scanAndQueue]);

  const setSyncPaused = useCallback(async (paused: boolean) => {
    const nextSettings = await updateLocalSyncSettings({ paused });
    setSettings(nextSettings);
    if (isMediaApiConfigured) await updateGallerySyncSettings({ paused });
  }, []);

  const updateSettings = useCallback(async (update: Partial<LocalSyncSettings>) => {
    const nextSettings = await updateLocalSyncSettings(update);
    setSettings(nextSettings);
    if (isMediaApiConfigured) await updateGallerySyncSettings(update);
    if (update.photosEnabled !== undefined || update.videosEnabled !== undefined) await scanAndQueue(nextSettings);
  }, [scanAndQueue]);

  const status: MediaSyncStatus = useMemo(() => {
    if (!settings.enabled) return 'disabled';
    if (permission === 'denied' || permission === 'unsupported') return 'permission_required';
    if (settings.paused) return 'paused';
    if (isBusy) return 'scanning';
    if (summary.pending === 0 && summary.uploading === 0) return 'complete';
    return 'active';
  }, [isBusy, permission, settings.enabled, settings.paused, summary.pending, summary.uploading]);

  return { permission, settings, summary, status, isBusy, error, enableSync, setSyncPaused, updateSettings, refreshQueue, scanAndQueue };
}
