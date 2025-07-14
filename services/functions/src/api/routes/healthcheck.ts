import { createRoute, RouteHandler, z } from "@hono/zod-openapi";
import { errorResponseSchemas } from "../errors";
import { HonoEnv } from "../honoEnv";

const route = createRoute({
  operationId: "healthcheck",
  method: "get",
  path: "/healthcheck",
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponseSchemas,
  },
});

const handler: RouteHandler<typeof route, HonoEnv> = async (c) => {
  return c.json({ message: "OK" }, 200);
};

export const HealthCheck = {
  route,
  handler,
};
