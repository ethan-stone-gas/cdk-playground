import { OpenAPIHono } from "@hono/zod-openapi";
import { HonoEnv } from "./honoEnv";
import { handle } from "hono/aws-lambda";
import { HealthCheck } from "./routes/healthcheck";
import { ConfigureDomain } from "./routes/configure-domain";
import { GetDomainConfiguration } from "./routes/get-domain-configuration";
import { cors } from "hono/cors";
import { handleError } from "./errors";
import { ConfigureSSO } from "./routes/configure-sso";
import { GetIdentityProviderForEmail } from "./routes/get-identity-provider-for-email";

const app = new OpenAPIHono<HonoEnv>();

app.onError(handleError);

app.use(
  cors({
    origin: "*",
    allowHeaders: ["*"],
    allowMethods: ["*"],
    credentials: true,
  })
);

app.openapi(HealthCheck.route, HealthCheck.handler);
app.openapi(ConfigureDomain.route, ConfigureDomain.handler);
app.openapi(GetDomainConfiguration.route, GetDomainConfiguration.handler);
app.openapi(ConfigureSSO.route, ConfigureSSO.handler);
app.openapi(
  GetIdentityProviderForEmail.route,
  GetIdentityProviderForEmail.handler
);

export const main = handle(app);
