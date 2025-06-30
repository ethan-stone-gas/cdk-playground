import { HttpRequest } from "../request";
import { ZohoContact } from "../schemas";

type CreateContactRequestBody = {
  email?: string;
  firstName?: string;
  lastName?: string;
};

type UpdateContactRequestBody = {
  email?: string;
  firstName?: string;
  lastName?: string;
};

export class ContactService {
  private apiUrl = "https://desk.zoho.com/api/v1";

  constructor(private readonly makeRequest: HttpRequest) {}

  public async create(contact: CreateContactRequestBody) {
    const response = await this.makeRequest(`${this.apiUrl}/contacts`, {
      method: "POST",
      body: JSON.stringify(contact),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to create contact", {
        cause: response,
      });
    }

    const data = await response.json();

    return ZohoContact.parse(data);
  }

  public async get(contactId: string) {
    const response = await this.makeRequest(
      `${this.apiUrl}/contacts/${contactId}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get contact", {
        cause: response,
      });
    }

    const data = await response.json();

    return ZohoContact.parse(data);
  }

  public async update(contactId: string, contact: UpdateContactRequestBody) {
    const response = await this.makeRequest(
      `${this.apiUrl}/contacts/${contactId}`,
      {
        method: "PUT",
        body: JSON.stringify(contact),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update contact", {
        cause: response,
      });
    }

    const data = await response.json();

    return ZohoContact.parse(data);
  }
}
