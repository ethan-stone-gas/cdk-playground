import { createRoute, RouteHandler, z } from "@hono/zod-openapi";
import { errorResponseSchemas, HTTPException } from "../errors";
import { HonoEnv } from "../honoEnv";
import { checkAuth } from "src/utils/check-auth";
import {
  getDomainVerificationRecordByOrganizationId,
  getOrganizationByOwnerId,
} from "src/utils/db";
import { promises as dns } from "dns";

const route = createRoute({
  operationId: "getDomainConfiguration",
  method: "get",
  path: "/domain-configuration",
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: z.object({
            recordName: z.string(),
            recordValue: z.string(),
            verified: z.boolean(),
          }),
        },
      },
    },
    ...errorResponseSchemas,
  },
});

const handler: RouteHandler<typeof route, HonoEnv> = async (c) => {
  const user = await checkAuth(c);

  const organization = await getOrganizationByOwnerId(user._id);

  if (!organization) {
    throw new HTTPException({
      message: "Organization not found",
      reason: "NOT_FOUND",
    });
  }

  const record = await getDomainVerificationRecordByOrganizationId(
    organization._id
  );

  if (!record) {
    throw new HTTPException({
      message: "Domain verification record not found",
      reason: "NOT_FOUND",
    });
  }

  try {
    const records = await dns.resolveTxt(record.recordName);

    const found = records.some((recordParts) => {
      const fullRecord = recordParts.join("");

      return fullRecord === record.recordValue;
    });

    return c.json(
      {
        recordName: record.recordName,
        recordValue: record.recordValue,
        verified: found,
      },
      200
    );
  } catch (error) {
    return c.json(
      {
        recordName: record.recordName,
        recordValue: record.recordValue,
        verified: false,
      },
      200
    );
  }
};

export const GetDomainConfiguration = {
  route,
  handler,
};
