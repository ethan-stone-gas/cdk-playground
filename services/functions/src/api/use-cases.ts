import { ticketService } from "./db";
import { Ticket, toBaseTicket, ZenDeskTicket } from "./schemas";
import { zoho } from "./zoho/client";

export async function syncTicket(
  providerId: string,
  provider: "zoho" | "zendesk"
) {
  if (provider === "zoho") {
    const zohoTicket = await zoho.tickets.get(providerId);

    const baseTicket = toBaseTicket.zoho(zohoTicket);

    const ticket: Ticket = {
      ...baseTicket,
      provider: "zoho",
      zohoTicket,
    };

    await ticketService.upsertTicket(ticket);
  } else if (provider === "zendesk") {
    const zendeskTicket: ZenDeskTicket = {
      id: 1,
      subject: "Test",
      description: "Test",
      status: "new",
      group_id: 1,
      custom_fields: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const baseTicket = toBaseTicket.zendesk(zendeskTicket);

    const ticket: Ticket = {
      ...baseTicket,
      provider: "zendesk",
      zendeskTicket,
    };

    const currentTicket = await ticketService.getTicketByProviderId(
      "zendesk",
      providerId
    );

    if (!currentTicket) {
      await ticketService.upsertTicket(ticket);

      return;
    }

    if (currentTicket.provider === "zoho") {
      return;
    }

    let closedAt: Date | null = null;

    if (
      currentTicket.provider === "zendesk" &&
      currentTicket.zendeskTicket.status !== "solved" &&
      currentTicket.zendeskTicket.status !== "closed" &&
      (ticket.zendeskTicket.status === "closed" ||
        ticket.zendeskTicket.status === "solved")
    ) {
      closedAt = new Date();
    }

    ticket.closedAt = closedAt;

    await ticketService.upsertTicket(ticket);
  }
}
