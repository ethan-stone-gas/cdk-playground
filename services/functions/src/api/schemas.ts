import z from "zod";

export const BaseTicket = z.object({
  id: z.string(),
  subject: z.string(),
  description: z.string(),
  status: z.enum(["open", "closed"]),
  resolution: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  closedAt: z.date().nullish(),
});

export const ZohoTicket = z.object({
  id: z.string(),
  subject: z.string().nullish(),
  description: z.string().nullish(),
  teamId: z.string().nullish(),
  statusType: z.string(),
  status: z.string(),
  isDeleted: z.boolean(),
  resolution: z.string().nullish(),
  departmentId: z.string(),
  lastActivityTime: z.string().datetime(),
  modifiedTime: z.string().datetime(),
  closedTime: z.string().datetime().nullish(),
  createdTime: z.string().datetime(),
});

export type ZohoTicket = z.infer<typeof ZohoTicket>;

export const Ticket = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("zoho"),
    zohoTicket: ZohoTicket,
    ...BaseTicket.shape,
  }),
]);

export type Ticket = z.infer<typeof Ticket>;

export const ZohoComment = z.object({
  id: z.string(),
  content: z.string(),
  contentType: z.string(),
  ticketId: z.string(),
  commentedTime: z.string().datetime(),
  modifiedTime: z.string().datetime(),
});

export type ZohoComment = z.infer<typeof ZohoComment>;

const BaseComment = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const Comment = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("zoho"),
    zohoComment: ZohoComment,
    ...BaseComment.shape,
  }),
]);

export type Comment = z.infer<typeof Comment>;
