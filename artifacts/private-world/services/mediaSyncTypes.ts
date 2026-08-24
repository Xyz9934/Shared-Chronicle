export type MediaType = 'photo' | 'video';

export type QueueState = 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'PAUSED';

export type LocalMediaRecord = {
  id: string;
  sourceMediaId: string;
  sourceUri: string;
  mediaType: MediaType;
  mimeType: string;
  filename: string | null;
  fileSize: number | null;
  modifiedAt: number | null;
  contentHash: string | null;
  serverMediaId: string | null;
  status: QueueState;
  attempts: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
};

export type LocalSyncSettings = {
  enabled: boolean;
  photosEnabled: boolean;
  videosEnabled: boolean;
  wifiOnly: boolean;
  chargingOnly: boolean;
  backgroundSyncEnabled: boolean;
  paused: boolean;
};

export type QueueInsert = Omit<LocalMediaRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};
