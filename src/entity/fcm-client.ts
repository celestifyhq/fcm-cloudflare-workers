import { ClientHttp2Session } from 'http2';

/**
 * HTTP2 client for sending the notification, furthermore this client implements the possibility
 * of saving the invalid FCM tokens to then communicate to the user.
 *
 * @author Kenble - f.taddia
 */
export interface FcmClient extends ClientHttp2Session {
    unregisteredTokens?: Array<string>;
}
