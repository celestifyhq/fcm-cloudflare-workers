import type { Context, MiddlewareHandler } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";

export const errorHandlerMiddleware: MiddlewareHandler = async (
  c: Context,
  next: any,
) => {
  const createErrorMessageResponse = (
    httpCode: ContentfulStatusCode,
    message: string,
    description: string,
  ) => {
    return c.json(
      {
        message,
        description,
      },
      httpCode,
    );
  };

  c.set("error", { response: createErrorMessageResponse });
  await next();
};
