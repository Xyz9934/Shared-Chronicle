import * as SQLite from 'expo-sqlite';
import type { LocalMediaRecord, LocalSyncSettings, QueueInsert, QueueState } from './mediaSyncTypes';

type DatabaseRow = {
  id: string;
  source_media_id: string;
  source_uri: string;
  media_type: 'photo' | 'video';
  mime_type: string;
  filename: string | null;
  file_size: number | null;
  modified_at: number | null;
  content_hash: string | null;
  server_media_id: string | null;
  status: QueueState;
  attempts: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
};

const databaseName = 'private-world-media-sync.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const defaultSettings: LocalSyncSettings = {
  enabled: false,
  photosEnabled: true,
  videosEnabled: true,
  wifiOnly: true,
  chargingOnly: false,
  backgroundSyncEnabled: true,
  paused: false,
};

function mapRow(row: DatabaseRow): LocalMediaRecord {
  return {
    id: row.id,
    sourceMediaId: row.source_media_id,
    sourceUri: row.source_uri,
    mediaType: row.media_type,
    mimeType: row.mime_type,
    filename: row.filename,
    fileSize: row.file_size,
    modifiedAt: row.modified_at,
    contentHash: row.content_hash,
    serverMediaId: row.server_media_id,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(databaseName).then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sync_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS local_media (
          id TEXT PRIMARY KEY NOT NULL,
          source_media_id TEXT NOT NULL,
          source_uri TEXT NOT NULL,
          media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
          mime_type TEXT NOT NULL,
          filename TEXT,
          file_size INTEGER,
          modified_at INTEGER,
          content_hash TEXT,
          server_media_id TEXT,
          status TEXT NOT NULL CHECK (status IN ('PENDING', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING', 'PAUSED')),
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS local_media_identity_idx
          ON local_media(source_media_id, modified_at, file_size);
        CREATE INDEX IF NOT EXISTS local_media_status_idx ON local_media(status);
        CREATE INDEX IF NOT EXISTS local_media_modified_idx ON local_media(modified_at);
      `);
      return database;
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function initializeMediaSyncDatabase(): Promise<void> {
  await getDatabase();
}

export async function enqueueMedia(input: QueueInsert): Promise<LocalMediaRecord> {
  const database = await getDatabase();
  const now = Date.now();
  const id = input.id ?? `${input.mediaType}-${input.sourceMediaId}-${input.modifiedAt ?? 'unknown'}`;
  const existing = await database.getFirstAsync<DatabaseRow>(
    'SELECT * FROM local_media WHERE source_media_id = ? AND modified_at IS ? AND file_size IS ?',
    input.sourceMediaId,
    input.modifiedAt ?? null,
    input.fileSize ?? null,
  );
  if (existing) return mapRow(existing);

  await database.runAsync(
    `INSERT INTO local_media (
      id, source_media_id, source_uri, media_type, mime_type, filename,
      file_size, modified_at, content_hash, server_media_id, status,
      attempts, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.sourceMediaId,
    input.sourceUri,
    input.mediaType,
    input.mimeType,
    input.filename,
    input.fileSize,
    input.modifiedAt,
    input.contentHash,
    input.serverMediaId,
    input.status,
    input.attempts,
    input.lastError,
    now,
    now,
  );
  const created = await database.getFirstAsync<DatabaseRow>('SELECT * FROM local_media WHERE id = ?', id);
  if (!created) throw new Error('The media queue item could not be created.');
  return mapRow(created);
}

export async function getQueueItem(id: string): Promise<LocalMediaRecord | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<DatabaseRow>('SELECT * FROM local_media WHERE id = ?', id);
  return row ? mapRow(row) : null;
}

export async function listQueueItems(status?: QueueState, limit = 100): Promise<LocalMediaRecord[]> {
  const database = await getDatabase();
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const rows = status
    ? await database.getAllAsync<DatabaseRow>('SELECT * FROM local_media WHERE status = ? ORDER BY modified_at ASC LIMIT ?', status, boundedLimit)
    : await database.getAllAsync<DatabaseRow>('SELECT * FROM local_media ORDER BY modified_at ASC LIMIT ?', boundedLimit);
  return rows.map(mapRow);
}

export async function updateQueueItem(
  id: string,
  update: { status?: QueueState; serverMediaId?: string | null; attempts?: number; lastError?: string | null },
): Promise<LocalMediaRecord | null> {
  const database = await getDatabase();
  const current = await getQueueItem(id);
  if (!current) return null;
  const nextStatus = update.status ?? current.status;
  const nextServerMediaId = update.serverMediaId === undefined ? current.serverMediaId : update.serverMediaId;
  const nextAttempts = update.attempts ?? current.attempts;
  const nextError = update.lastError === undefined ? current.lastError : update.lastError;
  await database.runAsync(
    'UPDATE local_media SET status = ?, server_media_id = ?, attempts = ?, last_error = ?, updated_at = ? WHERE id = ?',
    nextStatus,
    nextServerMediaId,
    nextAttempts,
    nextError,
    Date.now(),
    id,
  );
  return getQueueItem(id);
}

export async function resetStaleUploads(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE local_media SET status = 'RETRYING', updated_at = ? WHERE status IN ('UPLOADING', 'PROCESSING')",
    Date.now(),
  );
}

export async function getLocalSyncSettings(): Promise<LocalSyncSettings> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM sync_settings');
  const settings = { ...defaultSettings };
  for (const row of rows) {
    if (row.key in settings) {
      const key = row.key as keyof LocalSyncSettings;
      settings[key] = row.value === 'true';
    }
  }
  return settings;
}

export async function updateLocalSyncSettings(update: Partial<LocalSyncSettings>): Promise<LocalSyncSettings> {
  const database = await getDatabase();
  const current = await getLocalSyncSettings();
  const next = { ...current, ...update };
  await database.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(next)) {
      await database.runAsync(
        'INSERT INTO sync_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        String(value),
      );
    }
  });
  return next;
}
