# GitHub Pages web deployment

The `@workspace/private-world` Expo app exports a static web build at the root of `https://pvtwrld.site/`. Pushes to `main` run `.github/workflows/deploy-pages.yml` and publish `artifacts/private-world/dist` with GitHub Pages.

## GitHub repository variables

Add these under **Settings > Secrets and variables > Actions > Variables**. These are Firebase Web SDK configuration values and are intended to be public in a browser bundle; do not put service-account data in them.

The existing Firebase Web project values identify project `crush-61d24`, auth domain `crush-61d24.firebaseapp.com`, storage bucket `crush-61d24.firebasestorage.app`, messaging sender ID `499774288399`, and app ID `1:499774288399:web:8783a68942b9129965297a`. The API key remains a GitHub-configured value and is intentionally not stored in this repository.

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_AUTH_API_URL` — `https://shared-chronicle--faizaniqubal206.replit.app` (without a trailing slash)

Use the actual values from the existing Firebase Web app and server deployment. Do not invent or commit credentials.

The Replit server must retain its existing server-only environment variables, including `FIREBASE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`, `TOMMY_PASSWORD`, `TOMMY_UID`, `JERRY_PASSWORD`, and `JERRY_UID`. They must never be added to `EXPO_PUBLIC_*` variables or GitHub Pages build variables. The server explicitly allows auth requests from `https://pvtwrld.site` and `https://www.pvtwrld.site`; `PAGES_ORIGIN` may additionally allow a configured development or legacy origin. The server intentionally does not emit a wildcard CORS origin.

After changing the Replit server or its Secrets, redeploy the production service and verify that `POST /auth/login` is reachable from the Pages origin. A `401` means credentials/account authorization was rejected; a `500` means the server-side Firebase or account configuration is incomplete.

In Firebase Authentication, add `pvtwrld.site` and `www.pvtwrld.site` to the authorized domains if they are not already present.

## GitHub Pages settings

Under **Settings > Pages**, set **Source** to **GitHub Actions**. No manual `dist` upload is required. The deployed site is:

<https://pvtwrld.site/>

The workflow copies the Expo `index.html` to `404.html` so a GitHub Pages refresh can load the client application instead of permanently returning a static-hosting 404.

## Local export

From the repository root:

```text
pnpm install
pnpm --filter @workspace/private-world exec expo export --platform web
```

The export is written to `artifacts/private-world/dist`. Public Firebase values can be supplied in the shell when testing Firebase locally; never use server credentials in the browser build.
