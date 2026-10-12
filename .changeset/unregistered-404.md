---
"fcm-cloudflare-workers": patch
---

`sendToTokens` and `sendToToken` now treat FCM's `UNREGISTERED` (404) response as an unregistered token. Before, only the 400 "not a valid FCM registration token" message was matched, so tokens from uninstalled apps were logged as errors and never returned.
