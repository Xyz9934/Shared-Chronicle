# Private World Music setup

## Private uploaded library

1. Apply `supabase/migrations/001_media_sync.sql` and then `supabase/migrations/002_private_music.sql` once. Do not rerun them destructively against an existing production database.
2. Confirm the `private-world-media` Supabase Storage bucket exists and remains private (`public = false`).
3. Confirm the provisioned space and both Firebase UIDs exist in `spaces` and `space_members`.
4. Configure these server-only Replit Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PRIVATE_WORLD_SPACE_ID`, and `FIREBASE_SERVICE_ACCOUNT_KEY` (or `GOOGLE_APPLICATION_CREDENTIALS`). Never expose the service-role key or service-account JSON through `EXPO_PUBLIC_*` or the Expo bundle.
5. Configure the app with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET`, and `EXPO_PUBLIC_AUTH_API_URL`. These client values do not grant direct private-library access.
6. Rebuild the Android development build after native-module or dependency changes.

The Android document picker accepts MP3, M4A/AAC, WAV, OGG, and Opus files. The client and trusted server reject unsupported extensions/MIME types, unreadable or empty files, and files over 100 MB. The server creates a path-specific signed upload permission under `spaces/{spaceId}/music/{musicId}.{extension}`, validates the uploaded object, and stores metadata in `public.private_world_music`.

Every library request requires a Firebase ID token. The server verifies the token, checks the Firebase profile and Supabase `space_members` membership, and only then uses the Supabase service role. Download and stream URLs expire after 10 minutes. Downloaded private tracks are stored in the device cache and can play offline; Spotify audio is never cached. A song can be deleted only by its uploader or a space owner, enforced by the server.

## Spotify App Remote for Android

Spotify integration uses the official Android App Remote SDK. It controls playback in the Spotify app and does not download, proxy, extract, or broadcast Spotify audio. The local Expo module is at `modules/spotify` and exposes connection, disconnect, player-state events, play, pause, resume, next, previous, and seek operations. Spotify tracks are never passed to the private `expo-audio` player or private download cache.

### One-time Spotify Developer Dashboard setup

1. Create a Spotify Developer application at the Spotify Developer Dashboard and copy its **Client ID**. Do not create or commit a client secret for this mobile integration.
2. Add the exact redirect URI `private-world://spotify-callback` to the application configuration. The URI must match `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` exactly, including case and punctuation.
3. Register the Android application package name `com.tommy_tech.pvtwrld` and the signing fingerprint required by the current Spotify Android/App Remote dashboard configuration. Use the fingerprint for the keystore that signs the development or release build being tested.
4. Configure the app environment with `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` and, optionally, `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI`. The Client ID is not a secret; never put a client secret in an `EXPO_PUBLIC_*` value, source control, or the APK.
5. Build and install the Android development build. Install the official Spotify app on the same device, sign in there, and allow the Private World app to connect when Spotify displays its authorization view.

### Authorization and security

The App Remote `ConnectionParams` flow is the official SDK authorization path for controlling the installed Spotify app. The SDK handles its authorization state; this module does not receive, log, persist, or transmit Spotify access or refresh tokens, so Android Keystore token storage is not required for this App Remote-only implementation. Authorization Code with PKCE is required if a future feature adds direct Spotify Web API access, such as search; that flow is not implemented here, and the app does not claim to support Spotify search.

The shared `music_room` document may contain provider, track ID/metadata, playback intent, position, timestamp, and actor. It must never contain Spotify passwords, tokens, raw audio URLs, or audio bytes. No Spotify audio is synchronized between members.

### Requirements and limitations

- Spotify must be installed and signed in on the target Android device.
- Starting or resuming music requires an eligible Spotify account, normally Premium. The app surfaces the SDK error when the account or device cannot perform the requested operation.
- Spotify Development Mode is intended for personal, non-commercial experimentation and may require the developer account to be assigned to the app. Do not build monetization or a commercial streaming service around this integration.
- App Remote controls the user's Spotify app; it does not provide an audio stream to Private World.

### Test procedure

1. Set the Client ID and exact redirect URI in the app environment without committing either as a secret.
2. Confirm the Android package and signing fingerprint in the Spotify Dashboard match the installed build.
3. Install Spotify, sign in with a real authorized account, and keep Spotify available on the device.
4. In Private World Music, press **Connect** in the Spotify section and approve the Spotify authorization view.
5. Verify the connected state and current-player metadata, then test play/pause, previous, next, and seek where supported.
6. Disconnect, reconnect after restarting the app, and verify the unavailable/error state when Spotify is not installed or the account lacks playback eligibility.

Use a real Spotify account and device for this test. Do not request, store, or print the Spotify password.

Official references: [Android SDK](https://developer.spotify.com/documentation/android), [PKCE guide](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), and [Developer Policy](https://developer.spotify.com/policy).
