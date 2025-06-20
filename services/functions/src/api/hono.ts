import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { HonoEnv } from "./app";
import { RequestValidationError } from "./error";
import { HTTPException } from "hono/http-exception";
import { ZohoWebhook } from "./zoho-webhook";

const app = new Hono<HonoEnv>();

app.onError(async (err, c) => {
  if (err instanceof RequestValidationError) {
    return c.json({ message: err.message }, err.status);
  }

  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }

  return c.json({ message: "Internal Server Error" }, 500);
});

app.get("/zoho-webhook", ZohoWebhook.handler);

export const main = handle(app);
