# Firebase setup for Private World

The app now uses Firebase Auth, Firestore, and Storage directly. It intentionally has no local/demo fallback.

## One-time setup

1. Enable **Email/Password** sign-in in Firebase Authentication.
2. Create exactly two Firebase Auth users.
3. Copy their Auth UIDs.
4. In Firestore, create a `users` document for each UID:
   - `name`: display name
   - `role`: `OWNER` for one account and `USER` for the other
   - `email`: account email
5. Create `settings/space` with the fields from `defaultSettings` in `context/CloudContext.tsx`.
6. Deploy `firebase/firestore.rules` and `firebase/storage.rules`.

The app only accepts a signed-in user with an existing `users/{uid}` document whose role is `OWNER` or `USER`. A random Firebase account cannot join the private space.