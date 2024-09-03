import { FcmMessage } from "../entity/fcm-message";
import { FcmOptions } from "../entity/fcm-options";
import { sign } from "@tsndr/cloudflare-worker-jwt";
import { FcmErrorResponse, FcmTokenResponse } from "../entity/fcm-responses";

/**
 * Class for sending a notification to multiple devices.
 */
export class FCM {
  private readonly fcmOptions: FcmOptions;
  private readonly fcmHost: string = "https://fcm.googleapis.com";

  constructor(options: FcmOptions) {
    this.fcmOptions = options;

    if (!this.fcmOptions.serviceAccount) {
      throw new Error(
        "Please provide the service account JSON configuration file."
      );
    }
  }

  async sendMulticast(
    message: FcmMessage,
    tokens: Array<string>
  ): Promise<Array<string>> {
    if (!message) {
      throw new Error("Message is mandatory");
    }

    if (!tokens?.length) {
      throw new Error("Token array is mandatory");
    }

    const tokenBatches: Array<Array<string>> = [];
    let batchLimit = Math.ceil(
      tokens.length / this.fcmOptions.maxConcurrentConnections
    );

    if (batchLimit <= this.fcmOptions.maxConcurrentStreamsAllowed) {
      batchLimit = this.fcmOptions.maxConcurrentStreamsAllowed;
    }

    for (let start = 0; start < tokens.length; start += batchLimit) {
      tokenBatches.push([...tokens.slice(start, start + batchLimit)]);
    }

    const unregisteredTokens: Array<string> = [];
    const projectId = this.fcmOptions.serviceAccount?.project_id;

    if (!projectId) {
      throw new Error(
        "Unable to determine Firebase Project ID from service account file."
      );
    }

    if (!this.fcmOptions.serviceAccount) {
      throw new Error("Service account is not defined.");
    }

    try {
      const accessToken = await this.getAccessToken();

      const results = await Promise.allSettled(
        tokenBatches.map((batch) =>
          this.processBatch(message, batch, projectId, accessToken)
        )
      );

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          unregisteredTokens.push(...result.value);
        } else {
          console.error("Error processing batch:", result.reason);
        }
      });

      return unregisteredTokens;
    } catch (err) {
      console.error("Error sending multicast:", err);
      throw err;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (!this.fcmOptions.serviceAccount) {
      throw new Error("Service account is not defined.");
    }

    // Try to get the cached access token if KV store is configured
    if (this.fcmOptions.kvStore && this.fcmOptions.kvCacheKey) {
      const cachedAccessToken = await this.getCachedAccessToken();
      if (cachedAccessToken) {
        return cachedAccessToken;
      }
    }

    // Generate a new JWT
    const now = Math.floor(Date.now() / 1000);
    const ttl = 3600; // 1 hour
    const payload = {
      iss: this.fcmOptions.serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + ttl,
      iat: now,
    };

    try {
      const jwt = await sign(payload, this.fcmOptions.serviceAccount.private_key, {
        algorithm: "RS256",
        header: { typ: "JWT" },
      });

      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as FcmTokenResponse;
      const newAccessToken = data.access_token;

      // Store the new access token in KV if configured
      if (this.fcmOptions.kvStore && this.fcmOptions.kvCacheKey) {
        await this.cacheAccessToken(newAccessToken, ttl);
      }
      
      return newAccessToken;
    } catch (error) {
      console.error("Error getting access token:", error);
      throw error;
    }
  }

  private async getCachedAccessToken(): Promise<string | null> {
    if (!this.fcmOptions.kvStore || !this.fcmOptions.kvCacheKey) {
      return null;
    }

    try {
      const cachedAccessToken = await this.fcmOptions.kvStore.get(this.fcmOptions.kvCacheKey);
      if (cachedAccessToken) {
        return cachedAccessToken;
      }
      return null;
    } catch (error) {
      console.error("Error retrieving cached access token:", error);
      return null;
    }
  }

  private async cacheAccessToken(accessToken: string, ttl: number): Promise<void> {
    if (!this.fcmOptions.kvStore || !this.fcmOptions.kvCacheKey) {
      return;
    }

    try {
      await this.fcmOptions.kvStore.put(this.fcmOptions.kvCacheKey, accessToken, { expirationTtl: ttl });
    } catch (error) {
      console.error("Error caching access token:", error);
    }
  }
  
  private async processBatch(
    message: any,
    devices: Array<string>,
    projectId: string,
    accessToken: string
  ): Promise<Array<string>> {
    const unregisteredTokens: Array<string> = [];
    const errors: Error[] = [];

    const results = await Promise.allSettled(
      devices.map((device) =>
        this.sendRequest(device, message, projectId, accessToken)
      )
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        if (result.reason.message === "UNREGISTERED") {
          unregisteredTokens.push(devices[index]);
        } else {
          errors.push(result.reason);
        }
      }
    });

    if (errors.length > 0) {
      console.error(`Errors occurred while processing batch: ${errors.length}`);
      errors.forEach((error) => console.error(error));
    }

    return unregisteredTokens;
  }
  
  private async sendRequest(
    device: string,
    message: any,
    projectId: string,
    accessToken: string,
    tries = 0
  ): Promise<void> {
    const url = `${this.fcmHost}/v1/projects/${projectId}/messages:send`;
    const clonedMessage = { ...message, token: device };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: clonedMessage }),
      });

      if (!response.ok) {
        const data = await response.json() as FcmErrorResponse;

        if (response.status >= 500 && tries < 3) {
          console.warn("Server error, retrying...", data);
          await new Promise((resolve) => setTimeout(resolve, 1000 * (tries + 1)));
          return this.sendRequest(
            device,
            message,
            projectId,
            accessToken,
            tries + 1
          );
        } else if (
          response.status === 400 &&
          data.error &&
          data.error.message.includes("not a valid FCM registration token")
        ) {
          throw new Error("UNREGISTERED");
        } else {
          throw new Error(`HTTP error! status: ${response.status}, message: ${data.error?.message || response.statusText}`);
        }
      }
    } catch (error) {
      console.error(`Error sending request to device ${device}:`, error);
      throw error;
    }
  }
}