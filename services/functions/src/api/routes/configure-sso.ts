import { createRoute, RouteHandler, z } from "@hono/zod-openapi";
import { errorResponseSchemas, HTTPException } from "../errors";
import { checkAuth } from "src/utils/check-auth";
import { HonoEnv } from "../honoEnv";
import {
  CognitoIdentityProviderClient,
  CreateIdentityProviderCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getOrganizationByOwnerId } from "src/utils/db";

const route = createRoute({
  operationId: "configureSSO",
  method: "post",
  path: "/configure-sso",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.discriminatedUnion("providerType", [
            z.object({
              providerType: z.literal("SAML"),
              providerDetails: z.object({
                idpMetadata: z.string(),
              }),
            }),
            z.object({
              providerType: z.literal("OIDC"),
              providerDetails: z.object({
                issuer: z.string(),
                clientId: z.string(),
                clientSecret: z.string(),
              }),
            }),
          ]),
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

const cognitoClient = new CognitoIdentityProviderClient({});

const handler: RouteHandler<typeof route, HonoEnv> = async (c) => {
  const user = await checkAuth(c);

  const { providerType, providerDetails } = c.req.valid("json");

  const ownedOrganization = await getOrganizationByOwnerId(user._id);

  if (!ownedOrganization) {
    throw new HTTPException({
      message: "Organization not found",
      reason: "NOT_FOUND",
    });
  }

  if (providerType === "OIDC") {
    await cognitoClient.send(
      new CreateIdentityProviderCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        ProviderName: ownedOrganization.name.replace(/-/g, ""),
        ProviderType: "OIDC",
        ProviderDetails: {
          client_id: providerDetails.clientId,
          client_secret: providerDetails.clientSecret,
          oidc_issuer: providerDetails.issuer,
          attributes_request_method: "GET",
          attributes_url_add_attributes: "false",
          authorize_scopes:
            "openid profile email aws.cognito.signin.user.admin",
        },
        AttributeMapping: {
          email: "email",
        },
        IdpIdentifiers: [ownedOrganization.name.replace(/-/g, "")],
      })
    );
  }

  return c.json({ status: "success" as const }, 200);
};

export const ConfigureSSO = {
  route,
  handler,
};
