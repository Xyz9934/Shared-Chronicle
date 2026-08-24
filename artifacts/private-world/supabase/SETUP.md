# Supabase media storage setup

Supabase stores synchronized media and metadata. Firebase Auth and Firestore remain in place; the Replit API is the trusted media control plane.

## Server-only environment variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

Never expose `SUPABASE_SERVICE_ROLE_KEY` through `EXPO_PUBLIC_*`, the Expo bundle, Android resources, or source control.

## Client environment variables
The existing client may use `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET`. These do not authorize synchronized private media operations. Automatic sync uses authenticated Replit API endpoints and short-lived signed URLs.

## Setup
1. Run `migrations/001_media_sync.sql` in the Supabase SQL editor.
2. Confirm `private-world-media` is private.
3. Provision one space and exactly two `space_members` rows using Firebase UIDs.
4. Remove anonymous Storage policies.

The API validates Firebase ID tokens, checks space membership, and uses the service role only for authorized operations. Existing Firestore photos remain unchanged until Phase 6 migration.
