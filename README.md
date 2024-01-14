# fcm-http2

[![npm version](https://badge.fury.io/js/fcm-http2.svg)](https://badge.fury.io/js/fcm-http2)

Library for sending multicast notifications using HTTP/2 multiplexing and the [FCM HTTP v1 API](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send).

Features supported by **fcm-http2**:

- [X] HTTP/2 session & stream concurrency
- [X] Token batching support
- [X] Uninstall detection
- [X] Retry mechanism

## How to use?

First you need to install the library via npm:

```shell
npm i fcm-http2
```

Once the library has been installed you can start using it in this way:

```js
// FCM library recovery
const FCM = require('fcm-http2');

// Init FCM with default options
// NOTE: Put the service-account.json file in the package's lib directory
const fcmClient = new FCM();

// Or you can specify options

const fcmClient = new FCM({
    // Pass in your service account JSON private key file (https://console.firebase.google.com/u/0/project/_/settings/serviceaccounts/adminsdk)
    serviceAccount: require('./service-account.json'),
    // Max number of concurrent HTTP/2 sessions (connections)
    maxConcurrentConnections: 10,
    // Max number of concurrent streams (requests) per session
    maxConcurrentStreamsAllowed: 100
});

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
};

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

## Requirements

* Node.js >= 12

## Support

For any doubts open an issue or contact this email **fctaddia@duck.com**
