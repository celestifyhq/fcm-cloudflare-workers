# fcm-cloudflare-workers

[![npm version](https://badge.fury.io/js/fcm-cloudflare-workers.svg)](https://badge.fury.io/js/fcm-cloudflare-workers)

Send multicast notifications using the [FCM HTTP v1 API](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send).
This project is a fork of [fcm-http2](https://www.npmjs.com/package/fcm-http2) and has been modified to work with Cloudflare Workers.

Features supported by **fcm-cloudflare-workers**:

- [X] HTTP/2 session & stream concurrency
- [X] Token batching support
- [X] Uninstall detection
- [X] Retry mechanism

## How to use?

First you need to install the library via npm:

```shell
npm i fcm-cloudflare-workers
```

Once the library has been installed you can start using it in this way:

```js
import { FCM, FcmOptions, FcmMessage } from "fcm-cloudflare-workers";

// Init FCM with options (minimal example)
const fcmOptions = new FcmOptions(
    // Pass in your service account JSON private key file (https://console.firebase.google.com/u/0/project/_/settings/serviceaccounts/adminsdk)
    serviceAccount: JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON),
);

// Or, init FCM with access token caching using KV (optional but recommended for performance)
const fcmOptions = new FcmOptions(
    serviceAccount: JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON),
    // Specify a KV namespace
    kvStoreName: env.MY_KV_NAMESPACE,
    // Specify a key to use for caching the access token
    kvCacheKey: 'fcm_access_token',
);

const fcmClient = new FCM(fcmOptions);

// Token to send the notification to
const tokens = ['TOKEN_1', 'TOKEN_N'];

// Composing the message to be sent
const message = {
    notification: {
        title: "Test",
        body: "Multiple Send"
    },
    data: {
        notification: "true"
    }
} as FcmMessage;

// Multiple sending of notification using token array
fcmClient.sendMulticast(message, tokens).then(unregisteredTokens => {

    // Sending successful
    console.log('Message sent successfully');

    // Remove unregistered tokens from your database
    if (unregisteredTokens.length > 0) {
        console.log('Unregistered device token(s): ', unregisteredTokens.join(', '));
    }

}).catch(error => console.log(error));
```

## Dependencies

* [@tsndr/cloudflare-worker-jwt](https://www.npmjs.com/package/@tsndr/cloudflare-worker-jwt)

## Contributions

This repo is based on previous work by [kenble](https://gitlab.com/kenble) and [eladnava](https://github.com/eladnava).

## Support

Please open an issue on this repo if you have any questions or need support.
