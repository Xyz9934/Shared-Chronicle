export type MediaType = "photo" | "video";

export type MediaStatus =
  | "pending"
  | "uploading"
  | "processing"
  | "completed"
  | "failed"
  | "deleted";

export type SyncSettings = {
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

export type MediaRecord = {
  id: string;
  spaceId: string;
  ownerId: string;
  deviceId: string | null;
  sourceMediaId: string;
  mediaType: MediaType;
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
  status: MediaStatus;
  uploadAttempts: number;
  lastError: string | null;
  uploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
