import z from "zod";
import { TicketService } from "./tickets";
import { AccessTokenManager } from "./auth-token-manager";

type Config = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  orgId: string;
};

export class ZohoClient {
  public tickets: TicketService;
  private accessTokenManager: AccessTokenManager;

  constructor(private readonly config: Config) {
    const accessTokenManager = new AccessTokenManager(config);
    this.accessTokenManager = accessTokenManager;

    const makeAuthenticatedRequest = async (
      url: string | URL | Request,
      options: RequestInit
    ) => {
      const accessToken = await accessTokenManager.getAccessToken();

      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          orgId: this.config.orgId,
        },
      });
    };

    this.tickets = new TicketService(makeAuthenticatedRequest);
  }
}

const zoho = new ZohoClient({
  clientId: process.env.ZOHO_CLIENT_ID!,
  clientSecret: process.env.ZOHO_CLIENT_SECRET!,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN!,
  orgId: process.env.ZOHO_ORG_ID!,
});
