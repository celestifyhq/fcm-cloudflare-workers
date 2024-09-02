import { FcmServiceAccount } from "./fcm-service-account";

/**
 * Entity for Firebase Cloud Messaging options.
 */
export class FcmOptions {
    serviceAccount?: FcmServiceAccount;
    maxConcurrentConnections: number;
    maxConcurrentStreamsAllowed: number;

    constructor(entity?: FcmOptions) {
        this.maxConcurrentConnections = 10;
        this.maxConcurrentStreamsAllowed = 100;
        if (entity) {
            this.serviceAccount = entity.serviceAccount;
            this.maxConcurrentConnections = entity.maxConcurrentConnections || 10;
            this.maxConcurrentStreamsAllowed = entity.maxConcurrentStreamsAllowed || 100;
        }
    }
}
