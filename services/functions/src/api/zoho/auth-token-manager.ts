import z from "zod";

type Config = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

const RefreshTokenResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

export class AccessTokenManager {
  private tokenUrl = "https://accounts.zoho.com/oauth/v2/token";
  private accessToken: string | null;
  private accessTokenExpiresAt: Date | null;

  constructor(private readonly config: Config) {
    this.config = config;
    this.accessToken = null;
    this.accessTokenExpiresAt = null;
  }

  public async getAccessToken() {
    if (
      this.accessToken &&
      this.accessTokenExpiresAt &&
      this.accessTokenExpiresAt > new Date()
    ) {
      return this.accessToken;
    }

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      body: JSON.stringify({
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to refresh access token", {
        cause: response,
      });
    }

    const data = await response.json();
    const parsedData = RefreshTokenResponse.parse(data);

    const expiresInMilliseconds = (parsedData.expires_in - 10) * 1000;

    this.accessToken = parsedData.access_token;
    this.accessTokenExpiresAt = new Date(Date.now() + expiresInMilliseconds);

    return this.accessToken;
  }
}
