import { createRoute, RouteHandler, z } from "@hono/zod-openapi";
import { errorResponseSchemas, HTTPException } from "../errors";
import { HonoEnv } from "../honoEnv";
import {
  createDomainVerificationRecord,
  getOrganizationByOwnerId,
} from "src/utils/db";
import { checkAuth } from "src/utils/check-auth";

const route = createRoute({
  operationId: "configureDomain",
  method: "post",
  path: "/configure-domain",
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
      description:
        "Given a domain, we will create a DNS record that the user must add to their DNS to validate they own the domain.",
      content: {
        "application/json": {
          schema: z.object({
            recordName: z.string(),
            recordValue: z.string(),
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

  const recordId = crypto.randomUUID();

  const randomValue = crypto.randomUUID().replace(/-/g, "");

  const recordName = `_pebble.${domain}`;
  const recordValue = `pebble-domain-verification=${randomValue}`;

  const ownedOrganization = await getOrganizationByOwnerId(user._id);

  if (!ownedOrganization) {
    throw new HTTPException({
      message: "Organization not found",
      reason: "NOT_FOUND",
    });
  }

  await createDomainVerificationRecord({
    _id: recordId,
    organizationId: ownedOrganization._id,
    recordName,
    recordValue,
    createdAt: new Date(),
  });

  return c.json({ recordName, recordValue }, 200);
};

export const ConfigureDomain = {
  route,
  handler,
};
