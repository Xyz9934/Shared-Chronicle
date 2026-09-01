import { randomUUID } from "node:crypto";
import type { MediaRecord, MediaStatus, MediaType, SyncSettings } from "../types/media";
import { logger } from "../lib/logger";
import { getSupabaseAdmin } from "./supabaseAdmin";

const bucket = () => process.env.SUPABASE_MEDIA_BUCKET?.trim() || "private-world-media";

type MediaServiceErrorCode = "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "STORAGE_ERROR";

export class MediaServiceError extends Error {
  constructor(
    public readonly code: MediaServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MediaServiceError";
  }
}

function requireFirebaseUser(userId: string | undefined): string {
  if (!userId) throw new MediaServiceError("FORBIDDEN", "Firebase authentication is required.");
  return userId;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function mapMedia(row: unknown): MediaRecord {
  const value = asRecord(row);
  return {
    id: String(value.id),
    spaceId: String(value.space_id),
    ownerId: String(value.owner_id),
    deviceId: asString(value.device_id),
    sourceMediaId: String(value.source_media_id),
    mediaType: value.media_type as MediaType,
    mimeType: String(value.mime_type),
    filename: asString(value.filename),
    fileSize: asNumber(value.file_size),
    createdAtSource: asString(value.created_at_source),
    modifiedAtSource: asString(value.modified_at_source),
    contentHash: asString(value.content_hash),
    storagePath: String(value.storage_path),
    thumbnailPath: asString(value.thumbnail_path),
    durationMs: asNumber(value.duration_ms),
    width: asNumber(value.width),
    height: asNumber(value.height),
    status: value.status as MediaStatus,
    uploadAttempts: Number(value.upload_attempts ?? 0),
    lastError: asString(value.last_error),
    uploadedAt: asString(value.uploaded_at),
    createdAt: String(value.created_at),
    updatedAt: String(value.updated_at),
  };
}

function mapSettings(row: unknown, spaceId: string, userId: string): SyncSettings {
  const value = asRecord(row);
  return {
    spaceId,
    userId,
    enabled: Boolean(value.enabled),
    photosEnabled: value.photos_enabled !== false,
    videosEnabled: value.videos_enabled !== false,
    wifiOnly: value.wifi_only !== false,
    chargingOnly: Boolean(value.charging_only),
    backgroundSyncEnabled: value.background_sync_enabled !== false,
    paused: Boolean(value.paused),
  };
}

async function assertMembership(spaceId: string, userId: string): Promise<void> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("space_members")
      .select("user_id")
      .eq("space_id", spaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new MediaServiceError("FORBIDDEN", "You are not a member of this private space.");
  } catch (error) {
    if (error instanceof MediaServiceError) throw error;
    const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
    let upstreamUrl = "not-configured";
    try {
      upstreamUrl = new URL(supabaseUrl).origin;
    } catch {
      if (supabaseUrl) upstreamUrl = "invalid-url";
    }
    logger.error({
      method: "GET",
      upstreamUrl,
      operation: "space-membership",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown network error",
    }, "Supabase membership verification failed");
    throw new MediaServiceError(
      "STORAGE_ERROR",
      `Could not verify space membership: ${error instanceof Error ? error.message : "Unknown network error"}`,
    );
  }
}

function validateMediaType(value: unknown): MediaType {
  if (value !== "photo" && value !== "video") {
    throw new MediaServiceError("BAD_REQUEST", "mediaType must be photo or video.");
  }
  return value;
}

export async function getSyncSettings(spaceId: string, userId: string): Promise<SyncSettings> {
  const verifiedUserId = requireFirebaseUser(userId);
  await assertMembership(spaceId, verifiedUserId);
  const { data, error } = await getSupabaseAdmin()
    .from("media_sync_settings")
    .select("*")
    .eq("space_id", spaceId)
    .eq("user_id", verifiedUserId)
    .maybeSingle();

  if (error) throw new MediaServiceError("STORAGE_ERROR", `Could not read sync settings: ${error.message}`);
  return mapSettings(data, spaceId, verifiedUserId);
}

export async function updateSyncSettings(
  spaceId: string,
  userId: string,
  input: Partial<Omit<SyncSettings, "spaceId" | "userId">>,
): Promise<SyncSettings> {
  const verifiedUserId = requireFirebaseUser(userId);
  await assertMembership(spaceId, verifiedUserId);
  const row = {
    space_id: spaceId,
    user_id: verifiedUserId,
    ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    ...(input.photosEnabled === undefined ? {} : { photos_enabled: input.photosEnabled }),
    ...(input.videosEnabled === undefined ? {} : { videos_enabled: input.videosEnabled }),
    ...(input.wifiOnly === undefined ? {} : { wifi_only: input.wifiOnly }),
    ...(input.chargingOnly === undefined ? {} : { charging_only: input.chargingOnly }),
    ...(input.backgroundSyncEnabled === undefined ? {} : { background_sync_enabled: input.backgroundSyncEnabled }),
    ...(input.paused === undefined ? {} : { paused: input.paused }),
  };
  const { data, error } = await getSupabaseAdmin()
    .from("media_sync_settings")
    .upsert(row, { onConflict: "space_id,user_id" })
    .select("*")
    .single();

  if (error) throw new MediaServiceError("STORAGE_ERROR", `Could not update sync settings: ${error.message}`);
  return mapSettings(data, spaceId, verifiedUserId);
}

export async function registerDevice(
  spaceId: string,
  userId: string,
  input: { deviceKey: string; model?: string; appVersion?: string },
): Promise<{ id: string }> {
  const verifiedUserId = requireFirebaseUser(userId);
  if (!input.deviceKey || input.deviceKey.length > 200) {
    throw new MediaServiceError("BAD_REQUEST", "deviceKey is required and must be at most 200 characters.");
  }
  await assertMembership(spaceId, verifiedUserId);
  const { data, error } = await getSupabaseAdmin()
    .from("media_devices")
    .upsert({
      space_id: spaceId,
      owner_id: verifiedUserId,
      device_key: input.deviceKey,
      platform: "android",
      model: input.model ?? null,
      app_version: input.appVersion ?? null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "space_id,owner_id,device_key" })
    .select("id")
    .single();

  if (error) throw new MediaServiceError("STORAGE_ERROR", `Could not register device: ${error.message}`);
  return { id: String(data.id) };
}

export async function registerMedia(
  spaceId: string,
  userId: string,
  input: {
    deviceId: string;
    sourceMediaId: string;
    mediaType: unknown;
    mimeType: string;
    filename?: string;
    fileSize?: number;
    createdAtSource?: string;
    modifiedAtSource?: string;
    contentHash?: string;
    durationMs?: number;
    width?: number;
    height?: number;
  },
): Promise<{ media: MediaRecord; alreadyExists: boolean }> {
  const verifiedUserId = requireFirebaseUser(userId);
  const mediaType = validateMediaType(input.mediaType);
  if (!input.deviceId || !input.sourceMediaId || !input.mimeType) {
    throw new MediaServiceError("BAD_REQUEST", "deviceId, sourceMediaId, and mimeType are required.");
  }
  await assertMembership(spaceId, verifiedUserId);

  const admin = getSupabaseAdmin();
  const existing = await admin
    .from("media")
    .select("*")
    .eq("space_id", spaceId)
    .eq("owner_id", verifiedUserId)
    .eq("device_id", input.deviceId)
    .eq("source_media_id", input.sourceMediaId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (existing.error) throw new MediaServiceError("STORAGE_ERROR", `Could not check media identity: ${existing.error.message}`);
  const matching = (existing.data ?? []).find((row) =>
    row.modified_at_source === (input.modifiedAtSource ?? null) &&
    row.file_size === (input.fileSize ?? null),
  );
  if (matching) return { media: mapMedia(matching), alreadyExists: true };

  const mediaId = randomUUID();
  const storagePath = `${spaceId}/${verifiedUserId}/${mediaType === "photo" ? "photos" : "videos"}/${mediaId}/original`;
  const { data, error } = await admin
    .from("media")
    .insert({
      id: mediaId,
      space_id: spaceId,
      owner_id: verifiedUserId,
      device_id: input.deviceId,
      source_media_id: input.sourceMediaId,
      media_type: mediaType,
      mime_type: input.mimeType,
      filename: input.filename ?? null,
      file_size: input.fileSize ?? null,
      created_at_source: input.createdAtSource ?? null,
      modified_at_source: input.modifiedAtSource ?? null,
      content_hash: input.contentHash ?? null,
      storage_path: storagePath,
      duration_ms: input.durationMs ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new MediaServiceError("STORAGE_ERROR", `Could not register media: ${error.message}`);
  return { media: mapMedia(data), alreadyExists: false };
}

export async function createUploadUrl(spaceId: string, userId: string, mediaId: string) {
  const verifiedUserId = requireFirebaseUser(userId);
  await assertMembership(spaceId, verifiedUserId);
  const { data: media, error: mediaError } = await getSupabaseAdmin()
    .from("media")
    .select("id, storage_path, owner_id, space_id, status")
    .eq("id", mediaId)
    .eq("space_id", spaceId)
    .eq("owner_id", verifiedUserId)
    .maybeSingle();

  if (mediaError) throw new MediaServiceError("STORAGE_ERROR", mediaError.message);
  if (!media) throw new MediaServiceError("NOT_FOUND", "Media record was not found.");
  if (media.status === "completed") return { mediaId, alreadyCompleted: true, path: media.storage_path };

  const { data, error } = await getSupabaseAdmin().storage.from(bucket()).createSignedUploadUrl(media.storage_path);
  if (error || !data) throw new MediaServiceError("STORAGE_ERROR", error?.message ?? "Could not create upload URL.");
  await getSupabaseAdmin().from("media").update({ status: "uploading", upload_attempts: 1 }).eq("id", mediaId);
  return { mediaId, path: media.storage_path, token: data.token, signedUrl: data.signedUrl };
}

export async function completeUpload(spaceId: string, userId: string, mediaId: string) {
  const verifiedUserId = requireFirebaseUser(userId);
  await assertMembership(spaceId, verifiedUserId);
  const { data, error } = await getSupabaseAdmin()
    .from("media")
    .update({ status: "processing", uploaded_at: new Date().toISOString(), last_error: null })
    .eq("id", mediaId)
    .eq("space_id", spaceId)
    .eq("owner_id", verifiedUserId)
    .select("*")
    .maybeSingle();

  if (error) throw new MediaServiceError("STORAGE_ERROR", error.message);
  if (!data) throw new MediaServiceError("NOT_FOUND", "Media record was not found.");
  return mapMedia(data);
}

export async function listMedia(spaceId: string, userId: string, options: { limit: number; offset: number; mediaType?: MediaType; ownerId?: string }) {
  const verifiedUserId = requireFirebaseUser(userId);
  await assertMembership(spaceId, verifiedUserId);
  let query = getSupabaseAdmin()
    .from("media")
    .select("*", { count: "exact" })
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("created_at_source", { ascending: false, nullsFirst: false })
    .range(options.offset, options.offset + options.limit - 1);
  if (options.mediaType) query = query.eq("media_type", options.mediaType);
  if (options.ownerId) query = query.eq("owner_id", options.ownerId);
  const { data, count, error } = await query;
  if (error) throw new MediaServiceError("STORAGE_ERROR", `Could not list media: ${error.message}`);
  return { items: (data ?? []).map(mapMedia), total: count ?? 0, limit: options.limit, offset: options.offset };
}

export async function createDownloadUrl(spaceId: string, userId: string, mediaId: string, thumbnail: boolean) {
  const verifiedUserId = requireFirebaseUser(userId);
  await assertMembership(spaceId, verifiedUserId);
  const { data: media, error } = await getSupabaseAdmin()
    .from("media")
    .select("storage_path, thumbnail_path")
    .eq("id", mediaId)
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new MediaServiceError("STORAGE_ERROR", error.message);
  if (!media) throw new MediaServiceError("NOT_FOUND", "Media record was not found.");
  const path = thumbnail ? media.thumbnail_path : media.storage_path;
  if (!path) throw new MediaServiceError("NOT_FOUND", "A thumbnail is not available for this media.");
  const signed = await getSupabaseAdmin().storage.from(bucket()).createSignedUrl(path, 300);
  if (signed.error || !signed.data) throw new MediaServiceError("STORAGE_ERROR", signed.error?.message ?? "Could not create download URL.");
  return { url: signed.data.signedUrl, expiresIn: 300 };
}

export async function retryMedia(spaceId: string, userId: string, mediaId: string) {
  const verifiedUserId = requireFirebaseUser(userId);
  await assertMembership(spaceId, verifiedUserId);
  const { data, error } = await getSupabaseAdmin()
    .from("media")
    .update({ status: "pending", last_error: null })
    .eq("id", mediaId)
    .eq("space_id", spaceId)
    .eq("owner_id", verifiedUserId)
    .select("*")
    .maybeSingle();
  if (error) throw new MediaServiceError("STORAGE_ERROR", error.message);
  if (!data) throw new MediaServiceError("NOT_FOUND", "Media record was not found.");
  return mapMedia(data);
}
