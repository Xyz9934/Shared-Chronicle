# Private World

An Android-first private digital space for two people to keep messages, memories, photos, and meaningful moments together.

## Run & Operate

- `pnpm --filter @workspace/private-world run dev` — run the Expo mobile app
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Optional Firebase env vars: `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, and `EXPO_PUBLIC_FIREBASE_APP_ID`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/private-world/app/index.tsx` — mobile app entry route
- `artifacts/private-world/components/PrivateWorldApp.tsx` — mobile-first screens and interaction surface
- `artifacts/private-world/context/AppContext.tsx` — two-user session, content models, and persistent local content
- `artifacts/private-world/services/firebase.ts` — Firebase configuration boundary
- `artifacts/private-world/constants/colors.ts` — shared romantic palette

## Architecture decisions

- The first build uses a content-driven context model with AsyncStorage persistence so the app remains usable before Firebase configuration is supplied.
- Firebase configuration is read only from Expo public environment variables and kept behind a service boundary for a later cloud adapter.
- The mobile shell uses a compact top navigation so Android phone users can move between Home, Chat, Memories, and Gallery without a dense desktop layout.

## Product

Private World supports two authorized preview accounts, persistent sign-in for the current session, local shared messages, memory creation, owner-only memory deletion, photo selection, a gallery, a timeline, and a personalized home dashboard.

## User preferences

- Keep the app private, warm, premium, personal, and mobile-first.
- Avoid childish visual treatment; use soft romantic color and restrained animation.

## Gotchas

- Firebase client configuration is not present yet, so the app visibly runs in Private preview mode and persists content locally.
- The two preview accounts are `owner@private.world` / `owner123` and `mira@private.world` / `mira123`; replace this preview adapter when Firebase Auth is connected.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
