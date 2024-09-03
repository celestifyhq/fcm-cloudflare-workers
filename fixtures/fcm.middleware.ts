import type { Context, MiddlewareHandler } from "hono";
import { FCM, FcmOptions } from 'fcm-cloudflare-workers';

import { env } from "hono/adapter";

type FirebaseEnv = {
  FIREBASE_SERVICE_ACCOUNT_JSON: string;
  MY_WORKER_CACHE: KVNamespace;
};

/**
 * An abstracted middleware that creates an instance of an FCM client
 *
 * @param c
 * @param next
 */
export const fcmMiddleware: MiddlewareHandler = async (
  c: Context,
  next: any,
) => {
  const firebaseEnv = env<FirebaseEnv>(c);

  const fcmOptions = new FcmOptions({
    serviceAccount: JSON.parse(firebaseEnv.FIREBASE_SERVICE_ACCOUNT_JSON),
    kvStore: firebaseEnv.MY_WORKER_CACHE,
    kvCacheKey: "fcm-token-cache",
  });

  const fcmClient = new FCM(fcmOptions);

  c.set("fcm", fcmClient);
  await next();
};
