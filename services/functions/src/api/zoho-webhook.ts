import { Handler } from "hono";
import { HonoEnv } from "./app";
import { validateRequestData } from "./validator";
import { z } from "zod";
import { Comment, Ticket } from "./schemas";

const payloadItem = z.discriminatedUnion("eventType", [
  z.object({
    eventType: z.literal("Ticket_Add"),
    payload: Ticket,
    eventTime: z.string().datetime(),
    orgId: z.string(),
  }),
  z.object({
    eventType: z.literal("Ticket_Update"),
    payload: Ticket,
    prevState: Ticket,
    eventTime: z.string().datetime(),
    orgId: z.string(),
  }),
  z.object({
    eventType: z.literal("Ticket_Delete"),
    payload: z.object({
      id: z.string(),
    }),
    eventTime: z.string().datetime(),
    orgId: z.string(),
  }),
  z.object({
    eventType: z.literal("Ticket_Comment_Add"),
    payload: Comment,
    eventTime: z.string().datetime(),
    orgId: z.string(),
  }),
  z.object({
    eventType: z.literal("Ticket_Comment_Update"),
    payload: Comment,
    eventTime: z.string().datetime(),
    orgId: z.string(),
  }),
]);

const bodySchema = z.array(payloadItem);

const handler: Handler<HonoEnv> = async (c) => {
  const body = await validateRequestData(bodySchema, c.req.json());

  return c.json({ message: "Hello World" });
};

export const ZohoWebhook = {
  handler,
};
