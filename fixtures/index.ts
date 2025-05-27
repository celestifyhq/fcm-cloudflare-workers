import { Hono } from "hono";
import { fcmMiddleware, FcmMiddlewareBindings, FcmMiddlewareVariables } from "./fcm.middleware";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { StatusCode } from "hono/utils/http-status";
import { FCM, FcmMessage, EnhancedFcmMessage } from "fcm-cloudflare-workers";

type AppBindings = FcmMiddlewareBindings & {
  // ANOTHER_KV: KVNamespace;
};

type AppVariables = FcmMiddlewareVariables & {
  error: {
    response: (
      statusCode: number,
      message: string,
      description: string
    ) => Response;
  };
};

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>().basePath(
  "/api"
);

app.use(async (c, next) => {
  c.set("error", {
    response: (statusCode, message, description) => {
      console.error(`Error: ${message} - ${description}`);
      return c.json({ error: message, description }, statusCode as any);
    },
  });
  await next();
});

app.use(fcmMiddleware);

// Schema for legacy single push
const sendSinglePushSchema = z.object({
  deviceToken: z.string(),
});

// Schema for legacy multi push
const sendMultiPushSchema = z.object({
  deviceTokens: z.array(z.string()),
});

// Schema for enhanced message
const enhancedMessageSchema = z.object({
  notification: z.object({
    title: z.string(),
    body: z.string(),
    image: z.string().optional(),
  }),
  data: z.record(z.string(), z.string()).optional(),
  android: z.object({
    notification: z.object({
      channel_id: z.string(),
      click_action: z.string().optional(),
    }).optional(),
    priority: z.enum(['normal', 'high']).optional(),
  }).optional(),
  apns: z.object({
    payload: z.object({
      aps: z.object({
        badge: z.number().optional(),
        sound: z.string().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
  webpush: z.object({
    notification: z.object({
      icon: z.string().optional(),
      badge: z.string().optional(),
    }).optional(),
  }).optional(),
});

// Legacy endpoints (using deprecated sendMulticast)
app.post("/push-single", zValidator("json", sendSinglePushSchema), async (c) => {
  const { deviceToken } = await c.req.json();

  const message = {
    notification: {
      title: "Test",
      body: "Test from single (legacy)",
    },
    data: {
      notification: "true",
    },
  } satisfies FcmMessage;

  try {
    const unregisteredTokens = await c.var.fcm.sendMulticast(message, [deviceToken]);
    console.log("Message sent successfully");
    if (unregisteredTokens.length > 0) {
      console.log("Unregistered device token(s): ", unregisteredTokens.join(", "));
    }
  } catch (error) {
    console.log(error);
    return c.var.error.response(400, "Sending Failed", (error as Error).message);
  }

  return c.json({ success: true });
});

app.post("/push-multi", zValidator("json", sendMultiPushSchema), async (c) => {
  const { deviceTokens } = await c.req.json();

  const message = {
    notification: {
      title: "Test",
      body: "Test from multiple (legacy)",
    },
    data: {
      notification: "true",
    },
  } satisfies FcmMessage;

  try {
    const unregisteredTokens = await c.var.fcm.sendMulticast(message, deviceTokens);
    console.log("Message sent successfully");
    if (unregisteredTokens.length > 0) {
      console.log("Unregistered device token(s): ", unregisteredTokens.join(", "));
    }
  } catch (error) {
    console.log(error);
    return c.var.error.response(400, "Sending Failed", (error as Error).message);
  }

  return c.json({ success: true });
});

app.post("/v2/push-token", zValidator("json", z.object({
  token: z.string(),
  message: enhancedMessageSchema,
})), async (c) => {
  const { token, message } = await c.req.json();

  try {
    await c.var.fcm.sendToToken(message as EnhancedFcmMessage, token);
    return c.json({ success: true });
  } catch (error) {
    console.log(error);
    return c.var.error.response(400, "Sending Failed", (error as Error).message);
  }
});

app.post("/v2/push-tokens", zValidator("json", z.object({
  tokens: z.array(z.string()),
  message: enhancedMessageSchema,
})), async (c) => {
  const { tokens, message } = await c.req.json();

  try {
    const unregisteredTokens = await c.var.fcm.sendToTokens(message as EnhancedFcmMessage, tokens);
    return c.json({ 
      success: true,
      unregisteredTokens: unregisteredTokens.length > 0 ? unregisteredTokens : undefined
    });
  } catch (error) {
    console.log(error);
    return c.var.error.response(400, "Sending Failed", (error as Error).message);
  }
});

app.post("/v2/push-topic", zValidator("json", z.object({
  topic: z.string(),
  message: enhancedMessageSchema,
})), async (c) => {
  const { topic, message } = await c.req.json();

  try {
    await c.var.fcm.sendToTopic(message as EnhancedFcmMessage, topic);
    return c.json({ success: true });
  } catch (error) {
    console.log(error);
    return c.var.error.response(400, "Sending Failed", (error as Error).message);
  }
});

app.post("/v2/push-condition", zValidator("json", z.object({
  condition: z.string(),
  message: enhancedMessageSchema,
})), async (c) => {
  const { condition, message } = await c.req.json();

  try {
    await c.var.fcm.sendToCondition(message as EnhancedFcmMessage, condition);
    return c.json({ success: true });
  } catch (error) {
    console.log(error);
    return c.var.error.response(400, "Sending Failed", (error as Error).message);
  }
});

export default app;
