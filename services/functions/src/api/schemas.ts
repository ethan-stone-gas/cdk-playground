import z from "zod";

export const Ticket = z.object({
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

export type Ticket = z.infer<typeof Ticket>;

export const Comment = z.object({
  id: z.string(),
  content: z.string(),
  contentType: z.string(),
  ticketId: z.string(),
  commentedTime: z.string().datetime(),
  modifiedTime: z.string().datetime(),
});

export type Comment = z.infer<typeof Comment>;
