import { useMutation } from "@tanstack/react-query";
import { fetchAuthSession } from "aws-amplify/auth";

const API_URL = import.meta.env.VITE_API_URL;

type ConfigureSSOParams = {
  providerType: "OIDC";
  issuer: string;
  clientId: string;
  clientSecret: string;
};

export function useConfigureSSO() {
  return useMutation({
    mutationFn: async (data: ConfigureSSOParams) => {
      const auth = await fetchAuthSession();

      const response = await fetch(`${API_URL}/configure-sso`, {
        method: "POST",
        body: JSON.stringify({
          providerType: data.providerType,
          providerDetails: {
            issuer: data.issuer,
            clientId: data.clientId,
            clientSecret: data.clientSecret,
          },
        }),
        headers: {
          Authorization: `${auth.tokens?.accessToken.toString()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to configure SSO");
      }

      return (await response.json()) as {
        status: "success" | "error";
      };
    },
  });
}
