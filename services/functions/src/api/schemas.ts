import z from "zod";

export const BaseContact = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ZohoContact = z.object({
  id: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  email: z.string().email(),
  phone: z.string().nullish(),
  createdTime: z.string().datetime(),
  modifiedTime: z.string().datetime(),
});

export const Contact = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("zoho"),
    zohoContact: ZohoContact,
    ...BaseContact.shape,
  }),
]);

export const BaseTicket = z.object({
  id: z.string(),
  subject: z.string(),
  description: z.string(),
  department: z.enum([
    "product_support",
    "oem_support",
    "field_service",
    "software_support",
    "site_onboarding",
  ]),
  status: z.enum(["open", "closed", "on_hold"]),
  providerId: z.string(),
  resolution: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  closedAt: z.date().nullish(),
});

export type BaseTicket = z.infer<typeof BaseTicket>;

export const ZohoTicket = z.object({
  id: z.string(),
  subject: z.string().nullish(),
  description: z.string().nullish(),
  teamId: z.string().nullish(),
  statusType: z.enum(["OPEN", "CLOSED", "ON_HOLD"]),
  status: z.string(),
  isDeleted: z.boolean(),
  resolution: z.string().nullish(),
  departmentId: z.string(),
  cf: z.object({
    cf_example: z.string().nullish(),
  }),
  lastActivityTime: z.string().datetime(),
  modifiedTime: z.string().datetime(),
  closedTime: z.string().datetime().nullish(),
  createdTime: z.string().datetime(),
});

export type ZohoTicket = z.infer<typeof ZohoTicket>;

export const ZenDeskTicket = z.object({
  id: z.number().int(),
  subject: z.string().nullish(),
  description: z.string().nullish(),
  status: z.enum(["new", "open", "pending", "hold", "solved", "closed"]),
  group_id: z.number().int(),
  custom_fields: z.array(z.object({})),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ZenDeskTicket = z.infer<typeof ZenDeskTicket>;

export const Ticket = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("zoho"),
    zohoTicket: ZohoTicket,
    ...BaseTicket.shape,
  }),
  z.object({
    provider: z.literal("zendesk"),
    zendeskTicket: ZenDeskTicket,
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

export const toBaseTicket = {
  zoho: (ticket: ZohoTicket): BaseTicket => {
    const departmentIdToDepartmentName: Record<
      string,
      BaseTicket["department"]
    > = {
      "100000000000000": "product_support",
      "100000000000001": "oem_support",
      "100000000000002": "field_service",
      "100000000000003": "software_support",
      "100000000000004": "site_onboarding",
    };

    return {
      id: ticket.id,
      subject: ticket.subject ?? "",
      description: ticket.description ?? "",
      department:
        departmentIdToDepartmentName[ticket.departmentId] ?? "product_support",
      providerId: ticket.id,
      status:
        ticket.statusType === "OPEN"
          ? "open"
          : ticket.statusType === "CLOSED"
          ? "closed"
          : "on_hold",
      resolution: ticket.resolution,
      createdAt: new Date(ticket.createdTime),
      updatedAt: new Date(ticket.modifiedTime),
      closedAt: ticket.closedTime ? new Date(ticket.closedTime) : undefined,
    };
  },

  zendesk: (ticket: ZenDeskTicket): BaseTicket => {
    return {
      id: ticket.id.toString(),
      subject: ticket.subject ?? "",
      description: ticket.description ?? "",
      department: "product_support",
      providerId: ticket.id.toString(),
      status:
        ticket.status === "new"
          ? "open"
          : ticket.status === "open"
          ? "open"
          : ticket.status === "pending"
          ? "on_hold"
          : ticket.status === "hold"
          ? "on_hold"
          : ticket.status === "solved"
          ? "closed"
          : "open",
      createdAt: new Date(ticket.created_at),
      updatedAt: new Date(ticket.updated_at),
      closedAt: undefined,
    };
  },
};
