import { createRoute, RouteHandler, z } from "@hono/zod-openapi";
import { errorResponseSchemas, HTTPException } from "../errors";
import { HonoEnv } from "../honoEnv";
import {
  getDomainVerificationRecordByRecordName,
  getOrganizationById,
} from "src/utils/db";
import {
  CognitoIdentityProviderClient,
  GetIdentityProviderByIdentifierCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const route = createRoute({
  operationId: "getIdentityProviderForEmail",
  method: "get",
  path: "/identity-provider-for-email",
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: z.object({
            identityProviderName: z.string(),
          }),
        },
      },
    },
    ...errorResponseSchemas,
  },
  request: {
    query: z.object({
      email: z.string(),
    }),
  },
});

const cognitoClient = new CognitoIdentityProviderClient({});

const handler: RouteHandler<typeof route, HonoEnv> = async (c) => {
  const email = c.req.query("email");

  if (!email) {
    throw new HTTPException({
      message: "Email is required",
      reason: "BAD_REQUEST",
    });
  }

  const emailDomain = email.split("@")[1];

  const recordToSearch = `_pebble.${emailDomain}`;

  const record = await getDomainVerificationRecordByRecordName(recordToSearch);

  if (!record) {
    throw new HTTPException({
      message: "Domain not verified",
      reason: "NOT_FOUND",
    });
  }

  const organization = await getOrganizationById(record.organizationId);

  if (!organization) {
    throw new HTTPException({
      message: "Organization not found",
      reason: "NOT_FOUND",
    });
  }

  const idp = await cognitoClient.send(
    new GetIdentityProviderByIdentifierCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID!,
      IdpIdentifier: organization.name.replace(/-/g, ""),
    })
  );

  if (!idp.IdentityProvider) {
    throw new HTTPException({
      message: "Identity provider not found",
      reason: "NOT_FOUND",
    });
  }

  return c.json(
    {
      identityProviderName: organization.name.replace(/-/g, ""),
    },
    200
  );
};

export const GetIdentityProviderForEmail = {
  route,
  handler,
};
