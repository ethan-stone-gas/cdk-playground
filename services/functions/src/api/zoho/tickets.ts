import { HttpRequest } from "../request";
import { ZohoTicket } from "../schemas";

type CreateTicketRequestBody = {
  subject: string;
  departmentId: string;
  contactId: string;
  description: string;
  teamId?: string;
};

type ListTicketsRequestBody = {
  page: number;
  per_page: number;
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
}
