# GitHub Pages web deployment

The `@workspace/private-world` Expo app exports a static web build at `/Shared-Chronicle/`. Pushes to `main` run `.github/workflows/deploy-pages.yml` and publish `artifacts/private-world/dist` with GitHub Pages.

## GitHub repository variables

Add these under **Settings > Secrets and variables > Actions > Variables**. These are Firebase Web SDK configuration values and are intended to be public in a browser bundle; do not put service-account data in them.

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_AUTH_API_URL` — the public HTTPS URL of the existing Replit server, without a trailing slash, for example `https://your-replit-domain.example`

Use the actual values from the existing Firebase Web app and server deployment. Do not invent or commit credentials.

The Replit server must retain its existing server-only environment variables, including `FIREBASE_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`, `TOMMY_PASSWORD`, `TOMMY_UID`, `JERRY_PASSWORD`, and `JERRY_UID`. They must never be added to `EXPO_PUBLIC_*` variables or GitHub Pages build variables. Set `PAGES_ORIGIN=https://dont-click-me.github.io` on that server if you want to restrict auth CORS to this site; otherwise the server's current fallback is permissive for this token endpoint.

In Firebase Authentication, add `dont-click-me.github.io` to the authorized domains if it is not already present.

## GitHub Pages settings

Under **Settings > Pages**, set **Source** to **GitHub Actions**. No manual `dist` upload is required. The deployed site is:

<https://dont-click-me.github.io/Shared-Chronicle/>

The workflow copies the Expo `index.html` to `404.html` so a GitHub Pages refresh can load the client application instead of permanently returning a static-hosting 404.

## Local export

From the repository root:

```text
pnpm install
pnpm --filter @workspace/private-world exec expo export --platform web
```

The export is written to `artifacts/private-world/dist`. Public Firebase values can be supplied in the shell when testing Firebase locally; never use server credentials in the browser build.
