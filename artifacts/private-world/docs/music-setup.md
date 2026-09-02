# Private World Music setup

## Private uploaded library

1. Run `supabase/migrations/001_media_sync.sql` and `supabase/migrations/002_private_music.sql` in order.
2. Create the private `private-world-media` bucket if it does not already exist, and keep it private.
3. Insert the private space and both Firebase UIDs into `spaces` and `space_members`.
4. Set server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY` (or `GOOGLE_APPLICATION_CREDENTIALS`), and `PRIVATE_WORLD_SPACE_ID`.
5. Set the app's `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. These are only used with a server-created, short-lived upload token; never expose the service-role key.
6. Deploy the server and rebuild the native app after dependency/config changes.

The client never chooses a space ID or storage object path. The server authenticates the Firebase ID token, verifies the user profile and Supabase membership, and then creates a short-lived signed upload/download permission for a single path. The server validates the object again before inserting metadata.

## Spotify (official Android App Remote only)

Spotify connection is intentionally a separate provider boundary. Before enabling it in a production build:

1. Create a Spotify developer app and register the exact redirect URI, for example `private-world://spotify-callback`.
2. Use Authorization Code with PKCE for the mobile app; never include a Spotify client secret in Expo public configuration.
3. Add the official Spotify Android App Remote SDK through a small Android native module, with the app's package name and signing fingerprints registered in Spotify.
4. Request only the scopes required for the integration, including `app-remote-control` for App Remote. Store a user's refresh token in encrypted server-side storage keyed to that user; never place it in Firestore, Supabase public data, or another member's device.
5. Make the provider surface a clear unavailable state when the Spotify app, account authorization, or Premium streaming requirement prevents playback.

The shared room may sync only provider, track ID/metadata, play-pause intention, timestamp, and actor. It must not synchronize Spotify audio. Do not download, cache, proxy, extract, or redistribute Spotify audio; only Private World uploads may be downloaded for offline use.

Spotify currently documents Authorization Code with PKCE for mobile/public clients and describes Android App Remote as controlling playback in the Spotify app. Its Developer Policy requires Premium for music streaming through the platform. See the official [PKCE guide](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [Android SDK documentation](https://developer.spotify.com/documentation/android), and [Developer Policy](https://developer.spotify.com/policy).
