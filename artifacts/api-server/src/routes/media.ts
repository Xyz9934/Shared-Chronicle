import { Router, type IRouter, type Request, type Response } from "express";
import { verifyFirebaseIdToken } from "../middlewares/firebaseAuth";
import {
  completeUpload,
  createDownloadUrl,
  createUploadUrl,
  getSyncSettings,
  listMedia,
  MediaServiceError,
  registerDevice,
  registerMedia,
  retryMedia,
  updateSyncSettings,
} from "../services/mediaService";
import type { MediaType } from "../types/media";

const router: IRouter = Router();
router.use(verifyFirebaseIdToken);

const userId = (req: Request): string => {
  const value = req.firebaseUser?.uid;
  if (!value) throw new MediaServiceError("FORBIDDEN", "Firebase authentication is required.");
  return value;
};

function body(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
}

function requireMediaId(req: Request): string {
  const value = req.params.mediaId;
  if (typeof value !== "string" || !value.trim()) throw new MediaServiceError("BAD_REQUEST", "mediaId is required.");
  return value;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function requireSpaceId(req: Request): string {
  const value = stringValue(req.query.spaceId);
  if (!value) throw new MediaServiceError("BAD_REQUEST", "spaceId is required.");
  return value;
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof MediaServiceError) {
    const status = error.code === "BAD_REQUEST" ? 400 : error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 500;
    res.status(status).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "The media operation could not be completed." });
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error: unknown) => sendError(res, error));
  };
}

router.get("/sync/settings", asyncRoute(async (req, res) => {
  res.json(await getSyncSettings(requireSpaceId(req), userId(req)));
}));

router.put("/sync/settings", asyncRoute(async (req, res) => {
  const input = body(req);
  const settings = await updateSyncSettings(requireSpaceId(req), userId(req), {
    enabled: typeof input.enabled === "boolean" ? input.enabled : undefined,
    photosEnabled: typeof input.photosEnabled === "boolean" ? input.photosEnabled : undefined,
    videosEnabled: typeof input.videosEnabled === "boolean" ? input.videosEnabled : undefined,
    wifiOnly: typeof input.wifiOnly === "boolean" ? input.wifiOnly : undefined,
    chargingOnly: typeof input.chargingOnly === "boolean" ? input.chargingOnly : undefined,
    backgroundSyncEnabled: typeof input.backgroundSyncEnabled === "boolean" ? input.backgroundSyncEnabled : undefined,
    paused: typeof input.paused === "boolean" ? input.paused : undefined,
  });
  res.json(settings);
}));

router.post("/devices", asyncRoute(async (req, res) => {
  const input = body(req);
  const device = await registerDevice(requireSpaceId(req), userId(req), {
    deviceKey: stringValue(input.deviceKey) ?? "",
    model: stringValue(input.model),
    appVersion: stringValue(input.appVersion),
  });
  res.status(201).json(device);
}));

router.post("/register", asyncRoute(async (req, res) => {
  const input = body(req);
  const result = await registerMedia(requireSpaceId(req), userId(req), {
    deviceId: stringValue(input.deviceId) ?? "",
    sourceMediaId: stringValue(input.sourceMediaId) ?? "",
    mediaType: input.mediaType,
    mimeType: stringValue(input.mimeType) ?? "",
    filename: stringValue(input.filename),
    fileSize: numberValue(input.fileSize),
    createdAtSource: stringValue(input.createdAtSource),
    modifiedAtSource: stringValue(input.modifiedAtSource),
    contentHash: stringValue(input.contentHash),
    durationMs: numberValue(input.durationMs),
    width: numberValue(input.width),
    height: numberValue(input.height),
  });
  res.status(result.alreadyExists ? 200 : 201).json(result);
}));

router.get("/", asyncRoute(async (req, res) => {
  const rawLimit = Number(req.query.limit ?? 50);
  const rawOffset = Number(req.query.offset ?? 0);
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  const offset = Number.isInteger(rawOffset) ? Math.max(rawOffset, 0) : 0;
  const requestedType = stringValue(req.query.mediaType);
  const mediaType: MediaType | undefined = requestedType === "photo" || requestedType === "video" ? requestedType : undefined;
  if (requestedType && !mediaType) throw new MediaServiceError("BAD_REQUEST", "mediaType must be photo or video.");
  res.json(await listMedia(requireSpaceId(req), userId(req), {
    limit,
    offset,
    mediaType,
    ownerId: stringValue(req.query.ownerId),
  }));
}));

router.post("/:mediaId/upload-url", asyncRoute(async (req, res) => {
  res.json(await createUploadUrl(requireSpaceId(req), userId(req), requireMediaId(req)));
}));

router.post("/:mediaId/complete", asyncRoute(async (req, res) => {
  res.json(await completeUpload(requireSpaceId(req), userId(req), requireMediaId(req)));
}));

router.post("/:mediaId/retry", asyncRoute(async (req, res) => {
  res.json(await retryMedia(requireSpaceId(req), userId(req), requireMediaId(req)));
}));

router.get("/:mediaId/download-url", asyncRoute(async (req, res) => {
  res.json(await createDownloadUrl(requireSpaceId(req), userId(req), requireMediaId(req), req.query.thumbnail === "true"));
}));

export default router;
