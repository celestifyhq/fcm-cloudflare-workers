import async from 'async';
import http2 from 'http2';
import { google } from 'googleapis';
import { FcmOptions } from '../entity/fcm-options';
import { FcmClient } from '../entity/fcm-client';

/**
 * Class for sending a notification to multiple devices using HTTP/2 multiplexing.
 *
 * @author Kenble - f.taddia
 */
export class FCM {

    /**
     * Options to manage calls to Firebase Cloud Messaging APIs.
     * @type {FcmOptions}
     */
    private readonly fcmOptions: FcmOptions = new FcmOptions();

    /**
     * Host of Firebase Cloud Messaging APIs.
     * @type {string}
     */
    private readonly fcmHost: string = 'https://fcm.googleapis.com';

    /**
     * Scope of Firebase Cloud Messaging APIs.
     * @type {Array<string>}
     */
    private readonly fcmScopes: Array<string> = ['https://www.googleapis.com/auth/firebase.messaging'];


    /**
     * Constructor to initialize FCM options.
     *
     * @author Kenble - f.taddia
     * @param options : FCM options, if undefined the default ones are used and the service-account.json
     * file present in the library directory is read
     */
    constructor(options?: FcmOptions) {
        
        if (options) {
            // Enhance fcmOptions with the user-specified object
            this.fcmOptions.serviceAccount = options.serviceAccount;
            this.fcmOptions.maxConcurrentConnections = options.maxConcurrentConnections || this.fcmOptions.maxConcurrentConnections;
            this.fcmOptions.maxConcurrentStreamsAllowed = options.maxConcurrentConnections || this.fcmOptions.maxConcurrentStreamsAllowed;
        } else {
            // If an object is not specified to value fcmOptions then the service-account.json is retrieved in the lib directory
            this.fcmOptions.serviceAccount = require('./service-account.json');
        }

        if (!this.fcmOptions.serviceAccount) {
            throw new Error('Please provide the service account JSON configuration file.');
        }

    }


    /**
     * Send a notification to multiple devices using HTTP/2 multiplexing.
     *
     * @author Kenble - f.taddia
     * @param message to send
     * @param tokens to send the notification to
     * @returns returns the list of tokens not registered in fcm
     */
    sendMulticast(message: any, tokens: Array<string>): Promise<Array<string>> {

        // Promisify method
        return new Promise<Array<string>>((resolve, reject) => {

            // Calculate max devices per batch, and prepare batches array
            let batchLimit = Math.ceil(tokens.length / this.fcmOptions.maxConcurrentConnections), tokenBatches: any[] = [];

            // Use just one batch/HTTP2 connection if batch limit is less than maxConcurrentStreamsAllowed
            if (batchLimit <= this.fcmOptions.maxConcurrentStreamsAllowed) {
                batchLimit = this.fcmOptions.maxConcurrentStreamsAllowed;
            }

            // Traverse tokens and split them up into batches of X devices each  
            for (let start = 0; start < tokens.length; start += batchLimit) {
                tokenBatches.push(tokens.slice(start, start + batchLimit));
            }

            // Keep track of unregistered device tokens
            let unregisteredTokens: Array<string> = [];

            // Get Firebase project ID from service account credentials
            let projectId = this.fcmOptions.serviceAccount.project_id;

            // Ensure we have a project ID
            if (!projectId) {
                return reject(new Error('Unable to determine Firebase Project ID from service account file.'));
            }

            // Get OAuth2 token
            this.getAccessToken(this.fcmOptions.serviceAccount).then((accessToken) => {

                // Count batches to determine when all notifications have been sent
                let done = 0;

                // Send notification using HTTP/2 multiplexing
                for (let tokenBatch of tokenBatches) {

                    // Send notification to current token batch
                    this.processBatch(message, tokenBatch, projectId, accessToken).then((unregisteredTokensList: Array<string>) => {

                        unregisteredTokensList.join()

                        // Add unregistred tokens (if any)
                        if (unregisteredTokensList.length > 0) {
                            unregisteredTokens.push(...unregisteredTokensList);
                        }

                        // Done with this batch
                        done++;

                        // If all batches processed, resolve final promise with list of unregistred tokens
                        if (done === tokenBatches.length) {
                            resolve(unregisteredTokens);
                        }

                    }).catch((err) => {
                        // Reject promise with error
                        reject(err);
                    });

                }

            }).catch((err) => {
                // Failed to generate OAuth2 token
                // most likely due to invalid credentials provided
                reject(err);
            });

        });

    }

    /**
     * OAuth2 access token generation method.
     *
     * @author Kenble - f.taddia
     * @param serviceAccount : object with information for authenticating to the Firebase Cloud Messaging APIs
     * @returns returns the access token
     */
    private getAccessToken(serviceAccount: any) {

        // Promisify method
        return new Promise<string>((resolve, reject) => {

            // Create JWT client with Firebase Messaging scope
            const jwtClient = new google.auth.JWT(
                serviceAccount.client_email,
                undefined,
                serviceAccount.private_key,
                this.fcmScopes,
                undefined
            );

            // Request OAuth2 token
            jwtClient.authorize((err, tokens) => {
                if (err) {
                    // Reject on error
                    return reject(err);
                }
                // Resolve promise with accss token
                resolve(tokens?.access_token!!);
            });

        });

    }

    /**
     * Sends notifications to a batch of tokens using HTTP/2.
     *
     * @author Cineca - f.taddia
     * @param message to notify
     * @param devices : list of devices to send the notification to
     * @param projectId : project id in the fcm console
     * @param accessToken : access token for fcm api
     * @returns returns the list of tokens not registered in fcm
     */
    private processBatch(message: any, devices: Array<string>, projectId: string, accessToken: string) {

        // Promisify method
        return new Promise<Array<string>>((resolve, reject) => {

            // Create an HTTP2 client and connect to FCM API
            const client: FcmClient = http2.connect(this.fcmHost, {
                peerMaxConcurrentStreams: this.fcmOptions.maxConcurrentConnections
            });

            // Log connection errors
            client.on('error', (err) => {
                // Connection reset?
                if (err.message.includes('ECONNRESET')) {
                    // Log temporary connection errors to console (retry mechanism inside sendRequest will take care of retrying)
                    return console.error('FCM HTTP2 Error', err);
                }

                // Throw connection error
                reject(err);
            });

            // Log socket errors
            client.on('socketError', (err) => reject(err));

            // Keep track of unregistered device tokens
            client.unregisteredTokens = [];

            // Use async/eachLimit to iterate over device tokens
            async.eachLimit(devices, this.fcmOptions.maxConcurrentStreamsAllowed, (device, doneCallback) => {
                // Create a HTTP/2 request per device token
                this.sendRequest(client, device, message, projectId, accessToken, doneCallback, 0);
            }, (err) => {
                // All requests completed, close the HTTP2 client
                client.close();

                if (err) {
                    // Reject on error
                    return reject(err);
                }

                // Resolve the promise with list of unregistered tokens
                resolve(client.unregisteredTokens!!);
            });

        });

    }

    /**
     * Sends a single notification over an existing HTTP/2 client.
     *
     * @author Cineca - f.taddia
     * @param client : http2 client with which to call the fcm api
     * @param device : device to send the notification to
     * @param message to send
     * @param projectId : project id in the fcm console
     * @param accessToken : access token for fcm api
     * @param doneCallback : callback when sending is finished
     * @param tries : number of attempts made for a failed send, maximum number of attempts is 3
     */
    private sendRequest(client: FcmClient, device: string, message: any, projectId: string, accessToken: string, doneCallback: any, tries: number) {

        // Create a HTTP/2 request per device token
        const request = client.request({
            ':method': 'POST',
            ':scheme': 'https',
            ':path': `/v1/projects/${projectId}/messages:send`,
            Authorization: `Bearer ${accessToken}`
        });

        // Set encoding as UTF8
        request.setEncoding('utf8');

        // Clone the message object
        const clonedMessage = Object.assign({}, message);

        // Assign device token for the message
        clonedMessage.token = device;

        // Send the request body as stringified JSON
        request.write(
            JSON.stringify({
                // validate_only: true, // Uncomment for dry run
                message: clonedMessage
            })
        );

        // Buffer response data
        let data = '';

        // Add each incoming chunk to response data
        request.on('data', (chunk) => data += chunk);

        // Keep track of whether we are already retrying this method invocation
        let retrying = false;

        // this
        const me = this;

        // Define error handler
        const errorHandler = function (err: any) {

            // Retry up to 3 times
            if (tries <= 3) {

                // Avoid retrying twice for the same error
                if (retrying) {
                    return;
                }

                // Keep track of whether we are already retrying in this context
                retrying = true;

                // If HTTP2 session destroyed, open a new one
                if (client.destroyed) {
                    // Crate new HTTP/2 session just for this failed device
                    return me.processBatch(message, [device], projectId, accessToken).finally(doneCallback);
                }

                // Retry request using same HTTP2 session in 10 seconds
                return setTimeout(() => { me.sendRequest(client, device, message, projectId, accessToken, doneCallback, tries) }, 10 * 1000);
            }

            // Log response data in error
            err.data = data;

            // Even if request failed, mark request as completed as we've already retried 3 times
            doneCallback(err);
        }

        // Keep track of called args for retry mechanism
        const args = arguments;

        // Response received in full
        request.on('end', () => {
            try {
                // Convert response body to JSON object
                const response = JSON.parse(data);

                // Error?
                if (response.error) {
                    // App uninstall?
                    if (response.error.details && response.error.details[0].errorCode === 'UNREGISTERED') {
                        // Add to unregistered tokens list
                        client.unregisteredTokens?.push(device);
                    } else {
                        // Call async done callback with error
                        return doneCallback(response.error);
                    }
                }

                // Mark request as completed
                doneCallback();
            } catch (err) {
                // Invoke error handler with retry mechanism
                errorHandler(err);
            }
        });

        // Log request errors
        request.on('error', (err) => {
            // Invoke error handler with retry mechanism
            errorHandler(err);
        });

        // Increment tries
        tries++;

        // Send the current request
        request.end();

    }

}
