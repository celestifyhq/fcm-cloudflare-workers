# fcm-cloudflare-workers

## 2.0.1

### Patch Changes

- 7b9ea40: Corrected ApnsPayload typescript interface to match spec.

## 2.0.0

### Major Changes

- dbe2a39: BREAKING CHANGES:

  - Deprecated `sendMulticast` method in favor of new targeting options
  - Added new message targeting options: topic and condition-based messaging
  - Introduced platform-specific configuration options for iOS and Android

  WHY:

  - Enhanced flexibility in message targeting to support broader use cases
  - Better control over platform-specific notification features
  - Improved alignment with Firebase Cloud Messaging's full capabilities
  - Simplified API by consolidating message targeting methods

  HOW TO UPDATE:

  1. Replace `sendMulticast` calls with the new targeting methods:

     ```typescript
     // Old way (deprecated)
     await fcm.sendMulticast(tokens, { notification });

     // New way
     await fcm.sendToTokens(tokens, { notification });
     ```

  2. Message targeting now supports three modes:
     - Token-based (using `sendToTokens`)
     - Topic-based (new)
     - Condition-based (new)
  3. Platform configurations can now be specified separately for iOS and Android
  4. Update your message payload structure to use the new targeting options if needed

  Example of new features:

  ```typescript
  // Token-based messaging (replaces sendMulticast)
  await fcm.sendToTokens(["token1", "token2"], {
    notification: { title: "Update", body: "New message!" },
  });

  // Topic messaging
  await fcm.sendToTopic("news", {
    notification: { title: "News Update", body: "Check out the latest news!" },
  });

  // Condition-based messaging
  await fcm.sendToCondition(
    "'sports' in topics && ('game' in topics || 'match' in topics)",
    {
      notification: { title: "Sports Update", body: "New game results!" },
    }
  );
  ```
