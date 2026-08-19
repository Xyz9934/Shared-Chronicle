# Private World

An Android-first private digital space for two people to keep messages, memories, photos, and meaningful moments together.

## Run & Operate

- `pnpm --filter @workspace/private-world run dev` — run the Expo mobile app
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required Private World Firebase env vars: `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, and `EXPO_PUBLIC_FIREBASE_APP_ID`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/private-world/app/index.tsx` — mobile app entry route
- `artifacts/private-world/components/CloudPrivateWorldApp.tsx` — Firebase-backed mobile screens and interaction surface
- `artifacts/private-world/context/CloudContext.tsx` — Firebase Auth, Firestore listeners, Storage uploads, and cloud mutations
- `artifacts/private-world/firebase/` — Firestore and Storage rules plus one-time setup notes
- `artifacts/private-world/services/firebase.ts` — Firebase configuration boundary
- `artifacts/private-world/constants/colors.ts` — shared romantic palette

## Architecture decisions

- The original local context and screens remain in the repository as Part 1 reference, but the active entry route uses `CloudProvider` and requires a verified Firebase session.
- Firebase configuration is read only from Expo public environment variables and kept behind a service boundary. Firestore listeners provide real-time synchronization and Storage holds uploaded media.
- The mobile shell uses a compact top navigation so Android phone users can move between Home, Chat, Memories, Gallery, Timeline, Letters, and Music without a dense desktop layout.

## Product

Private World supports exactly two Firebase-authorized people, persistent Firebase sign-in, real-time chat with read state, cloud memories and gallery photos, editable timeline entries, letters with envelope reveal, Storage-backed music with playback, secret reveal content, and owner customization.

## User preferences

- Keep the app private, warm, premium, personal, and mobile-first.
- Avoid childish visual treatment; use soft romantic color and restrained animation.

## Gotchas

- Firebase is intentionally fail-closed: the active app does not use demo accounts or local fallback data. Configure all six public Firebase variables, create the two Auth users, seed their `users/{uid}` allowlist documents, and deploy both rule files before login can succeed.
- Push notifications are represented in-app through live unread badges and read receipts; a provider such as OneSignal can be connected later if device push delivery is required.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
