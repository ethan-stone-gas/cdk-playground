import { createRoute, RouteHandler, z } from "@hono/zod-openapi";
import { errorResponseSchemas } from "../errors";
import { checkAuth } from "src/utils/check-auth";
import { HonoEnv } from "../honoEnv";

const route = createRoute({
  operationId: "configureSSO",
  method: "post",
  path: "/configure-sso",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            domain: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "",
      content: {
        "application/json": {
          schema: z.object({
            status: z.enum(["success", "error"]),
          }),
        },
      },
    },
    ...errorResponseSchemas,
  },
});

const handler: RouteHandler<typeof route, HonoEnv> = async (c) => {
  const user = await checkAuth(c);

  const { domain } = c.req.valid("json");

  return c.json({ status: "success" as const }, 200);
};

export const ConfigureSSO = {
  route,
  handler,
};
