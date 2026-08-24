export {
  MediaSyncModule,
  getMediaAccessStatusAsync,
  requestMediaAccessAsync,
  scanMediaPageAsync,
  hasLegacyStoragePermissionAsync,
  scheduleUploadAsync,
  cancelUpload,
} from './MediaSyncModule';
export type { MediaAccessStatus, MediaScanItem, MediaScanPage, MediaUploadOptions } from './MediaSyncModule';
