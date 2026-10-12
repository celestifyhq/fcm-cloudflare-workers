---
"fcm-cloudflare-workers": patch
---

Remove unused `peerDependencies` on `zod`, `hono` and `@hono/zod-validator`. They were only used by the local dev fixture, and forced consumers onto zod v3. The package is now dependency-free and works alongside zod v3 or v4 (#18).
