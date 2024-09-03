import { FcmServiceAccount } from "./fcm-service-account";

/**
 * Entity for Firebase Cloud Messaging options.
 */
export class FcmOptions {
    serviceAccount: FcmServiceAccount;
    maxConcurrentConnections: number;
    maxConcurrentStreamsAllowed: number;
    kvStore?: KVNamespace;
    kvCacheKey?: string;

    constructor(options: {
        serviceAccount: FcmServiceAccount;
        maxConcurrentConnections?: number;
        maxConcurrentStreamsAllowed?: number;
        kvStore?: KVNamespace;
        kvCacheKey?: string;
    }) {
        this.serviceAccount = options.serviceAccount;
        this.maxConcurrentConnections = options.maxConcurrentConnections ?? 10;
        this.maxConcurrentStreamsAllowed = options.maxConcurrentStreamsAllowed ?? 100;
        this.kvStore = options.kvStore;
        this.kvCacheKey = options.kvCacheKey;
    }
}