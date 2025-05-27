import type { Context, MiddlewareHandler } from "hono";
import { FCM, FcmOptions } from 'fcm-cloudflare-workers';
import { KVNamespace } from "@cloudflare/workers-types";

export type FcmMiddlewareBindings = {
  FIREBASE_SERVICE_ACCOUNT_JSON: string;
  MY_WORKER_CACHE: KVNamespace;
};

export type FcmMiddlewareVariables = {
  fcm: FCM;
};

/**
 * An abstracted middleware that creates an instance of an FCM client
 *
 * @param c
 * @param next
 */
export const fcmMiddleware: MiddlewareHandler<{ Bindings: FcmMiddlewareBindings, Variables: FcmMiddlewareVariables }> = async (
  c: Context<{ Bindings: FcmMiddlewareBindings, Variables: FcmMiddlewareVariables }>,
  next: () => Promise<void>,
) => {
  const serviceAccountJson = c.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const kvCache = c.env.MY_WORKER_CACHE;

  if (!serviceAccountJson) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON not found in c.env");
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not found in environment bindings.");
  }
  if (!kvCache) {
    console.error("MY_WORKER_CACHE not found in c.env");
    throw new Error("MY_WORKER_CACHE not found in environment bindings.");
  }

  try {
    const fcmOptions = new FcmOptions({
      serviceAccount: JSON.parse(serviceAccountJson),
      kvStore: kvCache,
      kvCacheKey: "fcm-token-cache",
    });
    const fcmClient = new FCM(fcmOptions);
    c.set("fcm", fcmClient);
  } catch (e) {
    console.error("Error initializing FCM client in middleware:", e);
    throw e;
  }
  
  await next();
};
