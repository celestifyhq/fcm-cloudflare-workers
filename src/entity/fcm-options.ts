/**
 * Entity for Firebase Cloud Messaging options.
 *
 * @author Cineca - f.taddia
 */
export class FcmOptions {

    serviceAccount: any;

    maxConcurrentConnections: number;

    maxConcurrentStreamsAllowed: number;


    constructor(entity?: FcmOptions) {
        this.serviceAccount = null;
        this.maxConcurrentConnections = 10;
        this.maxConcurrentStreamsAllowed = 100;
        if (entity) {
            this.serviceAccount = entity.serviceAccount;
            this.maxConcurrentConnections = entity.maxConcurrentConnections || 10;
            this.maxConcurrentStreamsAllowed = entity.maxConcurrentStreamsAllowed || 100;
        }
    }

}
