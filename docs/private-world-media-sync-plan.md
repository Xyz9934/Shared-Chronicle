# Private World Automatic Android Media Sync

## Six-phase implementation plan

Private World is an Android-only private relationship and memories app for exactly two authorized users. The existing Firebase Authentication, Firebase Firestore, Expo Router, and Replit backend architecture will be preserved. Supabase will become the secure media-storage and media-metadata system.

### Phase 1 — Security, Identity, and Supabase Foundation

- Retain Firebase Authentication and the existing two-user profile model.
- Validate Firebase ID tokens in the Replit backend.
- Map Firebase UIDs to Supabase `space_members`.
- Add Supabase `spaces`, `space_members`, `media_devices`, `media`, and `media_sync_settings` tables.
- Add indexes, update timestamps, and database authorization policies.
- Make the Supabase Storage bucket private.
- Remove anonymous Storage access and use server-issued signed upload/download URLs.
- Keep the Supabase service-role key exclusively on the Replit server.
- Do not introduce Firebase Cloud Functions or require Blaze billing.

### Phase 2 — Media API and Local Queue

- Add authenticated Replit media endpoints.
- Add device registration and synchronization settings APIs.
- Add signed upload and download URL APIs.
- Add a durable Android SQLite queue for MediaStore items.
- Persist upload state, retries, errors, source identity, and server media IDs.

### Phase 3 — Android MediaStore Scanner and Permission Flow

- Add an Expo development-build native module and config plugin.
- Request Android media permissions only after the user enables Media Sync.
- Support Android 12 and earlier storage permissions, Android 13 image/video permissions, and Android 14 partial access.
- Query MediaStore metadata in Kotlin in batches.
- Return content URIs and metadata without loading full files into JavaScript memory.

### Phase 4 — Upload Pipeline and Background Synchronization

- Stream uploads natively instead of creating full-file JavaScript Blobs.
- Use bounded concurrency, retry backoff, and resumable/interrupted upload handling.
- Add Android WorkManager with network, Wi-Fi, charging, pause, and retry constraints.
- Run foreground scans when opening Our Memories and periodic background reconciliation when Android permits.
- Use foreground services only for genuinely long-running user-visible work if required.

### Phase 5 — Thumbnails, Gallery, and Sync UI

- Generate image thumbnails and video poster frames outside the React UI.
- Keep original and thumbnail objects in separate private Storage paths.
- Add the `❤️ Our Memories` gallery using paginated metadata and thumbnail-first loading.
- Add photo/video/all/owner filters, date grouping, full-screen viewing, video playback, loading, empty, error, and retry states.
- Add Enable, Pause, Resume, permission, network, charging, progress, and failure UI.

### Phase 6 — Migration, Testing, and Production Hardening

- Migrate existing Firestore photo records and Storage objects without deleting legacy data prematurely.
- Preserve ownership and source dates during migration.
- Verify authorization, private Storage, signed URL expiry, and service-role isolation.
- Test permissions, process death, device restart, offline operation, retries, duplicate scans, changed files, large videos, and large libraries.
- Measure memory, scan duration, upload throughput, query volume, gallery performance, and battery impact.
- Remove legacy photo reads and writes only after migration validation and rollback coverage.

## Phase 1 file plan

### New files

- `artifacts/private-world/supabase/migrations/001_media_sync.sql` — Supabase schema, indexes, RLS, and private Storage policies.
- `artifacts/api-server/src/middlewares/firebaseAuth.ts` — Firebase ID-token verification middleware.
- `artifacts/api-server/src/services/supabaseAdmin.ts` — server-only Supabase service-role client.

### Existing files

- `artifacts/api-server/package.json` — add server-only Firebase Admin and Supabase dependencies.
- `artifacts/private-world/supabase/SETUP.md` — replace public-bucket instructions with private Storage and server API instructions.
- `artifacts/private-world/services/supabase.ts` — retain only public client behavior appropriate for legacy/manual features; automatic sync will use the Replit API.

## Security decisions

- Firebase UID is the application identity and is stored as text in `space_members`.
- The Replit server validates Firebase tokens before any privileged media operation.
- The mobile client never receives a Supabase service-role key.
- The media bucket is private.
- Storage paths are generated from server-controlled space, owner, media, and type values.
- Deleting a phone file never deletes its cloud copy.
- Explicit cloud deletion will require a separate authorized operation.
- The Phase 1 SQL migration is prepared for deployment but is not executed against a remote Supabase project automatically.

## Phase 2 implementation notes

Implemented in the workspace:

- `artifacts/api-server/src/routes/media.ts` — authenticated `/api/media` routes.
- `artifacts/api-server/src/services/mediaService.ts` — membership checks, device registration, settings, media registration, source-identity deduplication, pagination, signed upload/download URLs, completion, and retry transitions.
- `artifacts/api-server/src/types/media.ts` — server media and synchronization contracts.
- `artifacts/private-world/services/mediaSyncRepository.ts` — durable Expo SQLite queue with WAL mode and stale-upload recovery.
- `artifacts/private-world/services/mediaSyncTypes.ts` — local queue and setting contracts.

Phase 2 deliberately does not implement MediaStore scanning, Android permissions, WorkManager, or native streaming uploads. Those remain Phase 3 and Phase 4 work. The API requires a Firebase bearer token and a `spaceId`; the server derives ownership from the verified Firebase UID and generates Storage paths itself.

## Phase 3 implementation notes

Implemented in the workspace:

- `artifacts/private-world/modules/media-sync` — local Expo module package and Android autolinking metadata.
- `artifacts/private-world/modules/media-sync/android/src/main/java/com/privateworld/mediasync/MediaSyncModule.kt` — Android permission-status and batched MediaStore metadata bridge.
- `artifacts/private-world/modules/media-sync/src/MediaSyncModule.ts` — safe permission request and scanner bridge with non-Android fallbacks.
- `artifacts/private-world/plugins/withMediaSync.js` — Android 13/14 and legacy storage permission config plugin.
- `artifacts/private-world/app.json` — config plugin registration.

Phase 3 uses an Expo development build or production build; Expo Go cannot load the local native module. The scanner returns content URIs and metadata only. It does not upload files, run WorkManager, or bypass Android permission decisions; those remain Phase 4 work.

## Phase 4 implementation notes

Implemented in the workspace:

- `artifacts/private-world/modules/media-sync/android/src/main/java/com/privateworld/mediasync/MediaSyncWorker.kt` — constrained WorkManager worker with retry/failure results.
- `artifacts/private-world/modules/media-sync/android/src/main/java/com/privateworld/mediasync/UploadCoordinator.kt` — authenticated API registration, signed-upload URL retrieval, streaming content-URI upload, and completion.
- `artifacts/private-world/modules/media-sync/android/src/main/java/com/privateworld/mediasync/SecureTokenStore.kt` — Android Keystore-backed Firebase token storage.
- `artifacts/private-world/modules/media-sync/src/MediaSyncModule.ts` — typed upload scheduling/cancellation bridge.
- `artifacts/private-world/services/mediaUploadScheduler.ts` — obtains a current Firebase token and schedules a queued Phase 2 item.

WorkManager applies Wi-Fi/unmetered-network and charging constraints. The Firebase token is not placed in WorkManager input data; it is encrypted with Android Keystore and keyed by media work ID. Upload scheduling is limited to one-time queued items in this phase; periodic MediaStore reconciliation and full queue completion-state reconciliation remain follow-up work.

## Phase 5 implementation notes

Implemented in the workspace:

- `artifacts/private-world/services/mediaGalleryApi.ts` — Firebase-authenticated paginated media API client, signed URL access, and sync settings/device helpers.
- `artifacts/private-world/hooks/useMediaSync.ts` — permission-aware sync state, SQLite queue summaries, incremental scan queueing, and settings controls.
- `artifacts/private-world/components/memories/OurMemoriesScreen.tsx` — `❤️ Our Memories` gallery, filters, sync controls, thumbnail-first tiles, full-screen viewer, video playback, and legacy Firestore fallback.
- `artifacts/private-world/components/CloudPrivateWorldApp.tsx` — existing Gallery navigation now hosts Our Memories without replacing the manual upload composer or legacy viewer.

Thumbnail generation remains a server-side follow-up. When a thumbnail path is unavailable, the gallery shows a placeholder rather than downloading the full original for the grid; originals are requested only when a media item is opened.

## Phase 6 implementation notes

Implemented in the workspace:

- `artifacts/private-world/scripts/migrate-legacy-photos.js` — dry-run-by-default Firestore-to-Supabase photo migration with explicit Firebase UID mapping, idempotency, generated object paths, and cleanup on metadata failure.
- `artifacts/private-world/package.json` — `media:migrate-legacy` command.
- `docs/private-world-production-checklist.md` — identity, Storage, Android release, migration/rollback, and operational hardening checklist.

The migration does not delete Firestore documents or legacy Storage objects. Remote writes require `--write`; a limited `--limit` run is recommended first. Device performance, Android native compilation, remote RLS enforcement, and production Storage verification must still be performed against configured projects and hardware.
