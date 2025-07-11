import { Context } from "hono";
import { HTTPException as HonoHTTPException } from "hono/http-exception";
import { z } from "@hono/zod-openapi";
import { generateErrorMessage } from "zod-error";
import { HonoEnv } from "./honoEnv";

export const ErrorReason = z.enum([
  "NOT_FOUND",
  "BAD_REQUEST",
  "FORBIDDEN",
  "UNAUTHORIZED",
  "RATELIMIT_EXCEEDED",
  "CONFLICT",
  "INTERNAL_SERVER_ERROR",
]);

export function createErrorSchema(
  reasons: [z.infer<typeof ErrorReason>, ...z.infer<typeof ErrorReason>[]]
) {
  return z.object({
    reason: z.enum(reasons).openapi({
      example: reasons[0],
      description:
        "A string that can be used programatically to determine the type of error",
    }),
    message: z.string().openapi({
      description: "A human-readable message for the error",
    }),
  });
}

export const errorResponseSchemas = {
  400: {
    description: "Bad Request",
    content: {
      "application/json": {
        schema: createErrorSchema(["BAD_REQUEST"]).openapi("ErrorBadRequest"),
      },
    },
  },
  401: {
    description: "Unauthorized",
    content: {
      "application/json": {
        schema: createErrorSchema(["UNAUTHORIZED"]).openapi(
          "ErrorUnauthorized"
        ),
      },
    },
  },
  403: {
    description: "Forbidden",
    content: {
      "application/json": {
        schema: createErrorSchema(["FORBIDDEN"]).openapi("ErrorForbidden"),
      },
    },
  },
  404: {
    description: "Not Found",
    content: {
      "application/json": {
        schema: createErrorSchema(["NOT_FOUND"]).openapi("ErrorNotFound"),
      },
    },
  },
  409: {
    description: "Conflict",
    content: {
      "application/json": {
        schema: createErrorSchema(["CONFLICT"]).openapi("ErrorConflict"),
      },
    },
  },
  429: {
    description: "Too many requests",
    content: {
      "application/json": {
        schema: createErrorSchema(["RATELIMIT_EXCEEDED"]).openapi(
          "ErrorTooManyRequests"
        ),
      },
    },
  },
  500: {
    description: "Internal Server Error",
    content: {
      "application/json": {
        schema: createErrorSchema(["INTERNAL_SERVER_ERROR"]).openapi(
          "ErrorInternalServerError"
        ),
      },
    },
  },
};

export const ErrorSchema = z.object({
  reason: ErrorReason.openapi({
    example: "INTERNAL_SERVER_ERROR",
    description:
      "A string that can be used programatically to determine the type of error",
  }),
  message: z.string().openapi({
    description: "A human-readable message for the error",
  }),
});

export type ErrorResponse = z.infer<typeof ErrorSchema>;

function reasonToStatus(reason: z.infer<typeof ErrorReason>) {
  switch (reason) {
    case "UNAUTHORIZED":
      return 401;
    case "RATELIMIT_EXCEEDED":
      return 429;
    case "NOT_FOUND":
      return 404;
    case "BAD_REQUEST":
      return 400;
    case "FORBIDDEN":
      return 403;
    case "CONFLICT":
      return 409;
    case "INTERNAL_SERVER_ERROR":
      return 500;
  }
}

export class HTTPException extends HonoHTTPException {
  public readonly reason: z.infer<typeof ErrorReason>;

  constructor(args: { reason: z.infer<typeof ErrorReason>; message: string }) {
    super(reasonToStatus(args.reason), { message: args.message });
    this.reason = args.reason;
  }
}

export function handleZodError(
  parseResult:
    | { success: true; data: any }
    | { success: false; error: z.ZodError },
  ctx: Context<HonoEnv>
) {
  if (!parseResult.success) {
    const readableMessage = generateErrorMessage(parseResult.error.issues);

    console.info(`Invalid request body. Reason: ${readableMessage}`);

    return ctx.json<ErrorResponse>(
      {
        reason: "BAD_REQUEST",
        message: readableMessage,
      },
      400
    );
  }
}

export function handleError(err: Error, ctx: Context<HonoEnv>): Response {
  if (err instanceof HTTPException) {
    return ctx.json<ErrorResponse>(
      {
        reason: err.reason,
        message: err.message,
      },
      err.status
    );
  }

  console.error("An internal server error occurred", {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
  });

  return ctx.json<ErrorResponse>(
    {
      reason: "INTERNAL_SERVER_ERROR",
      message: "An internal server error occurred",
    },
    500
  );
}
