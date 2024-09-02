import { Hono } from "hono";
import { fcmMiddleware } from "./fcm.middleware";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { StatusCode } from "hono/utils/http-status";
import { FCM } from "../src/lib/fcm";
import { FcmMessage } from "../src/entity/fcm-message";

type Bindings = {
  FIREBASE_PROJECT_ID: string; // Firebase project ID
  FIREBASE_SERVICE_ACCOUNT_JSON: string; // Firebase service account JSON
};

type Variables = {
  error: {
    response: (
      StatusCode: StatusCode,
      message: string,
      description: string
    ) => void;
  };
  fcm: FCM,
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath(
  "/api"
);

app.use("*", fcmMiddleware);

const sendSinglePushSchema = z.object({
  deviceToken: z.string(),
});

app.post("/push-single", zValidator("json", sendSinglePushSchema), async (c) => {
  const { deviceToken } = await c.req.json();

  const tokens = [deviceToken];

  const message = {
    notification: {
      title: "Test",
      body: "Test from single",
    },
    data: {
      notification: "true",
    },
  } satisfies FcmMessage;

  try {
    const unregisteredTokens = await c.var.fcm.sendMulticast(message, tokens);

    // Sending successful
    console.log("Message sent successfully");

    // Remove unregistered tokens from your database
    if (unregisteredTokens.length > 0) {
      console.log(
        "Unregistered device token(s): ",
        unregisteredTokens.join(", ")
      );
    }
  } catch (error) {
    console.log(error);
    return c.var.error.response(400, "Sending Failed", error.message);
  }

  return c.json({ success: true });
});

const sendMultiPushSchema = z.object({
  deviceTokens: z.array(z.string()),
});

app.post("/push-multi", zValidator("json", sendMultiPushSchema), async (c) => {
  const { deviceTokens } = await c.req.json();

  const tokens = deviceTokens;

  const message = {
    notification: {
      title: "Test",
      body: "Test from multiple",
    },
    data: {
      notification: "true",
    },
  } satisfies FcmMessage;

  try {
    const unregisteredTokens = await c.var.fcm.sendMulticast(message, tokens);

    // Sending successful
    console.log("Message sent successfully");

    // Remove unregistered tokens from your database
    if (unregisteredTokens.length > 0) {
      console.log(
        "Unregistered device token(s): ",
        unregisteredTokens.join(", ")
      );
    }
  } catch (error) {
    console.log(error);
    return c.var.error.response(400, "Sending Failed", error.message);
  }

  return c.json({ success: true });
});

export default app;
