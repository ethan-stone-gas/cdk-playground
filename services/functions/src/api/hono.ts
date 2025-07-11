import { OpenAPIHono } from "@hono/zod-openapi";
import { HonoEnv } from "./honoEnv";
import { handle } from "hono/aws-lambda";
import { HealthCheck } from "./routes/healthcheck";

const app = new OpenAPIHono<HonoEnv>();

app.openapi(HealthCheck.route, HealthCheck.handler);

export const main = handle(app);
