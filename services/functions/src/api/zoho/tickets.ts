import { z } from "zod";
import { HttpRequest } from "../request";
import { ZohoTicket } from "../schemas";

type CreateTicketRequestBody = {
  subject: string;
  departmentId: string;
  contactId: string;
  description: string;
  teamId?: string;
};

type ListTicketsRequestParams = {
  from?: number;
  limit?: number;
  status?: string;
};

export class TicketService {
  private apiUrl = "https://desk.zoho.com/api/v1";

  constructor(private readonly makeRequest: HttpRequest) {}

  public async create(body: CreateTicketRequestBody) {
    const response = await this.makeRequest(`${this.apiUrl}/tickets`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get ticket", {
        cause: response,
      });
    }

    const data = await response.json();

    return ZohoTicket.parse(data);
  }

  public async get(ticketId: string) {
    const response = await this.makeRequest(
      `${this.apiUrl}/tickets/${ticketId}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get ticket", {
        cause: response,
      });
    }

    const data = await response.json();

    return ZohoTicket.parse(data);
  }

  public async list(params: ListTicketsRequestParams) {
    const queryParams = new URLSearchParams();

    if (params.from) {
      queryParams.set("from", params.from.toString());
    }
    if (params.limit) {
      queryParams.set("limit", params.limit.toString());
    }
    if (params.status) {
      queryParams.set("status", params.status);
    }

    const response = await this.makeRequest(
      `${this.apiUrl}/tickets?${queryParams.toString()}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to list tickets", {
        cause: response,
      });
    }

    const data = await response.json();

    return z
      .object({
        data: z.array(ZohoTicket),
      })
      .parse(data);
  }

  public async close(ticketIds: string[]) {
    const response = await this.makeRequest(`${this.apiUrl}/closeTickets`, {
      method: "POST",
      body: JSON.stringify({
        ids: ticketIds,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to close tickets", {
        cause: response,
      });
    }

    return;
  }
}
