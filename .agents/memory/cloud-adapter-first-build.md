---
name: Cloud adapter first build
description: The mobile app keeps its content model behind a service boundary so it can run locally before a cloud provider is configured.
---

Use a local persistence mode for the first mobile build when the requested cloud project credentials or SDK are not available, but keep the data model and service boundary ready for the real provider. Make the active mode visible in the UI so preview data is never mistaken for synchronized production data.

**Why:** Firebase was requested but no Firebase connection was available in the workspace, so blocking the first usable mobile build would have delayed the product without providing a way to authorize the service.

**How to apply:** When cloud credentials become available, replace the adapter internals with authenticated cloud operations and security rules while preserving the existing content types and screen-level actions.