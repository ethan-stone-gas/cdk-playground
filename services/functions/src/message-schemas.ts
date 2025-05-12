import { z } from "zod";

export const RequestMessageSchema = z.object({
  entityId: z.string(),
  windowIdentifier: z.string(),
  count: z.number(),
  timestamp: z.number(),
});

export type RequestMessage = z.infer<typeof RequestMessageSchema>;
